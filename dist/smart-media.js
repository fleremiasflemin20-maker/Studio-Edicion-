/* Browser-local semantic search and person cutouts; never opens capture devices. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FleremahiasSmartMedia = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
  const abort = () => new DOMException('Operation canceled.', 'AbortError');
  function check(signal) {
    if (signal?.aborted) throw abort();
  }
  function segmentTranscript(words) {
    if (!Array.isArray(words)) throw Error('A timed transcript is required.');
    if (words.length > 15000) throw Error('Use a transcript with at most 15,000 words.');
    const valid = words.map((w) => ({
      text: String(w.text || '')
        .trim()
        .slice(0, 500),
      start: Number(w.start),
      end: Number(w.end),
    }));
    if (
      valid.some(
        (w, i) =>
          !w.text ||
          !Number.isFinite(w.start) ||
          !Number.isFinite(w.end) ||
          w.start < 0 ||
          w.end <= w.start ||
          (i && w.start < valid[i - 1].start),
      )
    )
      throw Error('Transcript timing is invalid.');
    const out = [];
    let batch = [];
    function flush() {
      if (batch.length) {
        out.push({
          text: batch.map((w) => w.text).join(' '),
          start: batch[0].start,
          end: batch[batch.length - 1].end,
        });
        batch = [];
      }
    }
    for (const word of valid) {
      if (
        batch.length &&
        (word.end - batch[0].start > 24 ||
          batch.map((w) => w.text).join(' ').length + word.text.length > 350)
      )
        flush();
      batch.push(word);
      if (
        batch
          .map((w) => w.text)
          .join(' ')
          .split(/\s+/).length >= 12 &&
        /[.!?。！？]$/.test(word.text)
      )
        flush();
    }
    flush();
    if (out.length > 250)
      throw Error('Choose a shorter transcript (at most 250 semantic passages).');
    return out;
  }
  function editMask(input, width, height, brushes = []) {
    if (
      !(input instanceof Uint8ClampedArray) ||
      input.length !== width * height ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width * height > 5000000
    )
      throw Error('Invalid person mask.');
    if (!Array.isArray(brushes) || brushes.length > 200)
      throw Error('At most 200 mask strokes are supported.');
    if (brushes.reduce((sum, stroke) => sum + (stroke.points?.length || 0), 0) > 4000)
      throw Error('Use at most 4,000 brush points.');
    const output = input.slice();
    for (const stroke of brushes) {
      if (
        !['erase', 'restore'].includes(stroke.mode) ||
        !Array.isArray(stroke.points) ||
        stroke.points.length > 1000
      )
        throw Error('Invalid mask stroke.');
      const radius =
          Math.max(0.002, Math.min(0.25, Number(stroke.radius) || 0.025)) * Math.min(width, height),
        r2 = radius * radius;
      let prev = null;
      for (const point of stroke.points) {
        const px = Number(point.x),
          py = Number(point.y);
        if (!Number.isFinite(px) || !Number.isFinite(py) || px < 0 || px > 1 || py < 0 || py > 1)
          throw Error('Mask points must use normalized coordinates.');
        const x = px * (width - 1),
          y = py * (height - 1),
          steps = prev
            ? Math.min(
                300,
                Math.ceil(Math.hypot(x - prev.x, y - prev.y) / Math.max(1, radius * 0.4)),
              )
            : 1;
        for (let step = 1; step <= steps; step++) {
          const cx = prev ? prev.x + ((x - prev.x) * step) / steps : x,
            cy = prev ? prev.y + ((y - prev.y) * step) / steps : y;
          for (
            let yy = Math.max(0, Math.floor(cy - radius));
            yy <= Math.min(height - 1, Math.ceil(cy + radius));
            yy++
          )
            for (
              let xx = Math.max(0, Math.floor(cx - radius));
              xx <= Math.min(width - 1, Math.ceil(cx + radius));
              xx++
            ) {
              if ((xx - cx) ** 2 + (yy - cy) ** 2 <= r2)
                output[yy * width + xx] = stroke.mode === 'erase' ? 0 : 255;
            }
        }
        prev = { x, y };
      }
    }
    return output;
  }
  function addWebmDuration(input, seconds) {
    if (
      !(input instanceof Uint8Array) ||
      input.length > 150 * 1024 * 1024 ||
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      seconds > 60
    )
      throw Error('Invalid WebM duration input.');
    const read = (offset, limit) => {
      if (offset >= limit) throw Error('Incomplete EBML element.');
      let idLength = 1,
        flag = 128;
      while (!(input[offset] & flag)) {
        idLength++;
        flag >>= 1;
        if (idLength > 4) throw Error('Invalid EBML identifier.');
      }
      const id = Array.from(input.slice(offset, offset + idLength))
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
      const sizeAt = offset + idLength;
      if (sizeAt >= limit) throw Error('Incomplete EBML size.');
      let sizeLength = 1;
      flag = 128;
      while (!(input[sizeAt] & flag)) {
        sizeLength++;
        flag >>= 1;
        if (sizeLength > 8) throw Error('Invalid EBML size.');
      }
      if (sizeAt + sizeLength > limit) throw Error('Incomplete EBML size.');
      let size = input[sizeAt] & (flag - 1),
        unknown = size === flag - 1;
      for (let i = 1; i < sizeLength; i++) {
        size = size * 256 + input[sizeAt + i];
        unknown = unknown && input[sizeAt + i] === 255;
      }
      const start = sizeAt + sizeLength,
        end = unknown ? limit : start + size;
      if (!Number.isSafeInteger(end) || end > limit) throw Error('EBML size exceeds file.');
      return { offset, id, idLength, sizeAt, sizeLength, start, end, unknown };
    };
    const sizeBytes = (size, width) => {
      let length = width || 1;
      while (size >= 2 ** (7 * length) - 1) {
        length++;
        if (length > 8) throw Error('EBML size too large.');
      }
      const out = new Uint8Array(length);
      let remaining = size;
      for (let i = length - 1; i >= 0; i--) {
        out[i] = remaining % 256;
        remaining = Math.floor(remaining / 256);
      }
      out[0] |= 1 << (8 - length);
      return out;
    };
    const join = (parts) => {
      const size = parts.reduce((s, p) => s + p.length, 0),
        out = new Uint8Array(size);
      let offset = 0;
      for (const p of parts) {
        out.set(p, offset);
        offset += p.length;
      }
      return out;
    };
    let segment, info;
    for (let offset = 0; offset < input.length;) {
      const element = read(offset, input.length);
      if (element.id === '18538067') {
        segment = element;
        break;
      }
      offset = element.end;
    }
    if (!segment) throw Error('No WebM segment found.');
    for (let offset = segment.start; offset < segment.end;) {
      const element = read(offset, segment.end);
      if (element.id === '114d9b74') throw Error('Indexed WebM must be remuxed instead.');
      if (element.id === '1549a966') {
        info = element;
        break;
      }
      if (element.unknown) break;
      offset = element.end;
    }
    if (!info || info.unknown) throw Error('No bounded WebM Info element found.');
    const children = [];
    let timeScale = 1000000;
    for (let offset = info.start; offset < info.end;) {
      const el = read(offset, info.end);
      if (el.id === '2ad7b1') {
        timeScale = 0;
        for (let i = el.start; i < el.end; i++) timeScale = timeScale * 256 + input[i];
      }
      if (el.id !== '4489') children.push(input.slice(el.offset, el.end));
      offset = el.end;
    }
    if (!timeScale) throw Error('Invalid WebM time scale.');
    const duration = new Uint8Array(11);
    duration.set([0x44, 0x89, 0x88]);
    new DataView(duration.buffer).setFloat64(3, (seconds * 1e9) / timeScale, false);
    children.push(duration);
    const contents = join(children),
      replacement = join([
        input.slice(info.offset, info.offset + info.idLength),
        sizeBytes(contents.length),
        contents,
      ]);
    const body = join([
      input.slice(segment.start, info.offset),
      replacement,
      input.slice(info.end, segment.end),
    ]);
    const segSize = segment.unknown
      ? input.slice(segment.sizeAt, segment.start)
      : sizeBytes(body.length, segment.sizeLength);
    return join([
      input.slice(0, segment.offset + segment.idLength),
      segSize,
      body,
      input.slice(segment.end),
    ]);
  }

  let semanticWorker = null,
    semanticJob = false,
    maskWorker = null,
    maskJob = false;
  let counter = 0;
  function request(worker, message, { signal, onProgress, timeout = 300000, transfer = [] } = {}) {
    check(signal);
    const id = ++counter;
    return new Promise((resolve, reject) => {
      const clean = () => {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        signal?.removeEventListener('abort', onAbort);
      };
      const fail = (error) => {
        clean();
        reject(error);
      };
      const onMessage = (event) => {
        const m = event.data;
        if (m.id !== id) return;
        if (m.type === 'progress') {
          onProgress?.(m);
          return;
        }
        if (m.type === 'error') fail(Error(m.message));
        else {
          clean();
          resolve(m);
        }
      };
      const onError = (event) => {
        worker.terminate();
        if (worker === semanticWorker) semanticWorker = null;
        if (worker === maskWorker) maskWorker = null;
        fail(Error(event.message || 'The local processing worker failed.'));
      };
      const onAbort = () => {
        worker.terminate();
        if (worker === semanticWorker) semanticWorker = null;
        if (worker === maskWorker) maskWorker = null;
        fail(abort());
      };
      const timer = setTimeout(() => {
        worker.terminate();
        if (worker === semanticWorker) semanticWorker = null;
        if (worker === maskWorker) maskWorker = null;
        fail(Error('Local processing timed out. Try a shorter file.'));
      }, timeout);
      signal?.addEventListener('abort', onAbort, { once: true });
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage({ ...message, id }, transfer);
    });
  }
  function makeWorker() {
    // MediaPipe's WASM bootstrap uses importScripts; dynamic import still loads Transformers.js here.
    return new Worker('smart-worker.js');
  }
  async function search(words, query, options = {}) {
    if (semanticJob) throw Error('A semantic search is already running.');
    const segments = segmentTranscript(words),
      text = String(query || '').trim();
    if (!text || text.length > 500) throw Error('Enter a topic with between 1 and 500 characters.');
    if (!segments.length) throw Error('Transcribe the recording before searching.');
    check(options.signal);
    semanticJob = true;
    try {
      semanticWorker ||= makeWorker();
      return await request(
        semanticWorker,
        {
          type: 'search',
          segments,
          query: text,
          limit: Math.max(1, Math.min(20, Math.floor(options.limit) || 8)),
        },
        options,
      );
    } finally {
      semanticJob = false;
    }
  }
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  function dimensions(w, h, max) {
    const scale = Math.min(1, max / Math.max(w, h));
    return {
      width: Math.max(2, Math.round((w * scale) / 2) * 2),
      height: Math.max(2, Math.round((h * scale) / 2) * 2),
    };
  }
  function background(value) {
    if (value === undefined || value === 'transparent') return 'transparent';
    if (/^#[a-f\d]{6}$/i.test(value)) return value;
    throw Error('Choose a six-digit background color or transparent.');
  }
  function compose(source, c, mask, { background: color = 'transparent', brushes = [] } = {}) {
    const ctx = c.getContext('2d'),
      alpha = editMask(mask.alpha, mask.width, mask.height, brushes),
      mc = canvas(mask.width, mask.height),
      mx = mc.getContext('2d'),
      image = mx.createImageData(mask.width, mask.height);
    for (let i = 0; i < alpha.length; i++) {
      image.data[i * 4] = 255;
      image.data[i * 4 + 1] = 255;
      image.data[i * 4 + 2] = 255;
      image.data[i * 4 + 3] = alpha[i];
    }
    mx.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(source, 0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mc, 0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'destination-over';
    if (color !== 'transparent') {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function png(c) {
    return new Promise((resolve, reject) =>
      c.toBlob(
        (blob) => (blob ? resolve(blob) : reject(Error('Could not encode the image.'))),
        'image/png',
      ),
    );
  }
  async function infer(source, options, temporal = false) {
    const bitmap = await createImageBitmap(source);
    return request(
      maskWorker,
      { type: 'segment', bitmap, temporal },
      { ...options, timeout: 30000, transfer: [bitmap] },
    );
  }
  async function removeBackground(blob, options = {}) {
    if (maskJob) throw Error('Background removal is already running.');
    if (!(blob instanceof Blob) || !blob.size) throw Error('Select an image or video file.');
    if (blob.size > 128 * 1024 * 1024) throw Error('Use a file smaller than 128 MB.');
    if (!/^(image|video)\//.test(blob.type)) throw Error('Select an image or video file.');
    const color = background(options.background);
    check(options.signal);
    maskJob = true;
    try {
      maskWorker ||= makeWorker();
      await request(maskWorker, { type: 'prepare-mask' }, options);
      check(options.signal);
      return blob.type.startsWith('image/')
        ? await removeImage(blob, { ...options, background: color })
        : await removeVideo(blob, { ...options, background: color });
    } finally {
      maskJob = false;
    }
  }
  async function removeImage(blob, options) {
    const image = await createImageBitmap(blob);
    try {
      if (image.width * image.height > 40000000)
        throw Error('Use an image smaller than 40 megapixels.');
      const { width, height } = dimensions(image.width, image.height, 2048),
        c = canvas(width, height),
        source = canvas(width, height);
      source.getContext('2d').drawImage(image, 0, 0, width, height);
      const mask = await infer(source, options);
      check(options.signal);
      compose(image, c, mask, options);
      const result = await png(c);
      check(options.signal);
      options.onProgress?.({ phase: 'render', progress: 1, message: 'Person cutout ready.' });
      return {
        blob: result,
        width,
        height,
        duration: 0,
        audioPreserved: false,
        mask: { width: mask.width, height: mask.height, alpha: mask.alpha },
        warnings: [
          'Person segmentation is designed for portraits. Review hair, hands and fine edges.',
        ],
      };
    } finally {
      image.close();
    }
  }
  async function refineImage(blob, mask, options = {}) {
    if (!(blob instanceof Blob) || !blob.type.startsWith('image/'))
      throw Error('Mask corrections require the original image.');
    check(options.signal);
    const image = await createImageBitmap(blob);
    try {
      const { width, height } = dimensions(image.width, image.height, 2048),
        c = canvas(width, height);
      compose(image, c, mask, { ...options, background: background(options.background) });
      return {
        blob: await png(c),
        width,
        height,
        mask,
        duration: 0,
        audioPreserved: false,
        warnings: [],
      };
    } finally {
      image.close();
    }
  }
  function waitMedia(video, event, signal) {
    check(signal);
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener(event, done);
        video.removeEventListener('error', error);
        signal?.removeEventListener('abort', cancel);
      };
      const done = () => {
        cleanup();
        resolve();
      };
      const error = () => {
        cleanup();
        reject(Error('Could not read this video.'));
      };
      const cancel = () => {
        cleanup();
        reject(abort());
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(Error('Reading video timed out.'));
      }, 20000);
      video.addEventListener(event, done, { once: true });
      video.addEventListener('error', error, { once: true });
      signal?.addEventListener('abort', cancel, { once: true });
    });
  }
  async function removeVideo(blob, options) {
    if (options.background === 'transparent')
      throw Error(
        'For video, choose a solid background color. Transparent output is available for photos.',
      );
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)
      throw Error('This browser does not support local video recording.');
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(
      (t) => MediaRecorder.isTypeSupported(t),
    );
    if (!mime) throw Error('This browser cannot encode WebM.');
    const v = document.createElement('video'),
      url = URL.createObjectURL(blob);
    let stream, audio, recorder, stopWatch;
    const tracks = [];
    v.preload = 'auto';
    v.playsInline = true;
    v.src = url;
    try {
      await waitMedia(v, 'loadeddata', options.signal);
      // MediaRecorder WebM may omit duration; a seek forces the browser to scan its final timestamp.
      if (!Number.isFinite(v.duration)) {
        let seek = waitMedia(v, 'seeked', options.signal);
        v.currentTime = 1e9;
        await seek;
        seek = waitMedia(v, 'seeked', options.signal);
        v.currentTime = 0;
        await seek;
      }
      check(options.signal);
      if (!Number.isFinite(v.duration) || v.duration <= 0 || v.duration > 30.05)
        throw Error(
          'Background removal supports video clips of up to 30 seconds. Trim the clip first.',
        );
      const { width, height } = dimensions(v.videoWidth, v.videoHeight, 720),
        c = canvas(width, height),
        source = canvas(width, height),
        sx = source.getContext('2d');
      sx.drawImage(v, 0, 0, width, height);
      const first = await infer(source, options, true);
      check(options.signal);
      compose(source, c, first, options);
      stream = c.captureStream(24);
      tracks.push(...stream.getTracks());
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw Error('Audio processing is unavailable.');
      audio = new AudioContext();
      await audio.resume();
      if (audio.state !== 'running')
        throw Error('Enable audio playback in this browser, then try again.');
      const input = audio.createMediaElementSource(v),
        destination = audio.createMediaStreamDestination();
      input.connect(destination);
      for (const track of destination.stream.getAudioTracks()) {
        stream.addTrack(track);
        tracks.push(track);
      }
      const chunks = [];
      let timedOut = false;
      recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 3500000,
        audioBitsPerSecond: 128000,
      });
      let recordingError;
      const finished = new Promise((resolve) => {
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.onerror = (e) => {
          recordingError = e.error || Error('Video encoding failed.');
          resolve();
        };
        recorder.onstop = () => resolve();
      });
      const cancel = () => {
        v.pause();
        if (recorder.state !== 'inactive') recorder.stop();
      };
      options.signal?.addEventListener('abort', cancel, { once: true });
      try {
        recorder.start(500);
        const renderStarted = performance.now();
        await v.play();
        stopWatch = setTimeout(() => {
          timedOut = true;
          cancel();
        }, 45000);
        while (!timedOut && !recordingError && !v.ended && v.currentTime < v.duration - 0.025) {
          check(options.signal);
          sx.drawImage(v, 0, 0, width, height);
          const mask = await infer(source, options, true);
          check(options.signal);
          compose(source, c, mask, options);
          options.onProgress?.({
            phase: 'render',
            progress: Math.min(1, v.currentTime / v.duration),
            message: 'Removing video background…',
          });
          await new Promise((resolve) => setTimeout(resolve, 12));
        }
        v.pause();
        if (recorder.state !== 'inactive') recorder.stop();
        await finished;
        check(options.signal);
        if (recordingError) throw recordingError;
        if (timedOut) throw Error('Video processing timed out. Use a shorter clip.');
        const raw = new Blob(chunks, { type: recorder.mimeType });
        const recordedDuration = (performance.now() - renderStarted) / 1000;
        const output = new Blob(
          [addWebmDuration(new Uint8Array(await raw.arrayBuffer()), recordedDuration)],
          { type: recorder.mimeType },
        );
        if (!output.size) throw Error('The encoded video is empty.');
        return {
          blob: output,
          width,
          height,
          duration: recordedDuration,
          sourceDuration: v.duration,
          audioPreserved: true,
          warnings: [
            'WebM output uses up to 24 FPS and a 720-pixel longest edge. Slow devices may repeat frames.',
            'The person mask is temporally smoothed; review hair and fast movement.',
          ],
        };
      } finally {
        options.signal?.removeEventListener('abort', cancel);
      }
    } finally {
      clearTimeout(stopWatch);
      v.pause();
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      for (const track of tracks) track.stop();
      if (audio) await audio.close().catch(() => {});
      v.removeAttribute('src');
      v.load();
      URL.revokeObjectURL(url);
    }
  }
  return {
    MODEL,
    search,
    segmentTranscript,
    editMask,
    addWebmDuration,
    removeBackground,
    refineImage,
  };
});
