/* Media lifecycle and analysis, shared by editor and export. */
(function (root) {
  const videos = new Map();
  let extraAudio = [],
    asr = null,
    detector = null;
  async function video(asset) {
    const v = document.createElement('video');
    v.playsInline = true;
    v.preload = 'auto';
    v.src = asset.url;
    await new Promise((r, j) => {
      v.onloadeddata = r;
      v.onerror = () => j(Error('No se puede leer ' + asset.name));
      setTimeout(() => j(Error('Tiempo de lectura agotado')), 25000);
    });
    return v;
  }
  async function prepareScene(scene) {
    for (const l of scene.layers || []) {
      if (l.kind !== 'video') continue;
      const a = assets.find((a) => a.id === l.asset);
      if (!a) throw Error('Falta el video superpuesto');
      let v = videos.get(l.id);
      if (!v || v.dataset.asset !== a.id) {
        v = await video(a);
        v.dataset.asset = a.id;
        v.muted = true;
        v.playbackRate = l.speed || 1;
        videos.set(l.id, v);
        assetImages.set(l.id, v);
      }
      if ((l.sourceStart || 0) >= v.duration)
        throw Error('El inicio de una capa supera la duración del video');
      await seekMedia(v, l.sourceStart || 0);
    }
  }
  function sync(scene, time, playing = false) {
    for (const l of scene.layers || []) {
      if (l.kind !== 'video') continue;
      const v = videos.get(l.id);
      if (!v) continue;
      const active = !l.hidden && time >= (l.startAt || 0) && (!l.endAt || time < l.endAt),
        target = Math.min(
          v.duration - 0.02,
          (l.sourceStart || 0) + Math.max(0, time - (l.startAt || 0)) * (l.speed || 1),
        );
      if (Math.abs(v.currentTime - target) > (playing ? 0.25 : 0.03))
        v.currentTime = Math.max(0, target);
      if (active && playing && v.paused) v.play().catch(() => {});
      if ((!active || !playing) && !v.paused) v.pause();
    }
  }
  async function decode(asset, rate = 16000) {
    if (!asset) throw Error('Selecciona un archivo');
    if (asset.blob.size > 200 * 1024 * 1024) throw Error('Procesa un archivo de menos de 200 MB');
    const ac = new AudioContext();
    let buffer;
    try {
      buffer = await ac.decodeAudioData(await asset.blob.arrayBuffer());
    } catch {
      throw Error(
        'El navegador no pudo decodificar el audio de este formato. Importa una pista WAV o MP3.',
      );
    } finally {
      await ac.close();
    }
    const offline = new OfflineAudioContext(1, Math.ceil(buffer.duration * rate), rate),
      source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start();
    return offline.startRendering();
  }
  function wav(buffer) {
    const n = buffer.length,
      data = new ArrayBuffer(44 + n * 2),
      v = new DataView(data),
      put = (p, s) => [...s].forEach((c, i) => v.setUint8(p + i, c.charCodeAt(0)));
    put(0, 'RIFF');
    v.setUint32(4, 36 + n * 2, true);
    put(8, 'WAVEfmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, buffer.sampleRate, true);
    v.setUint32(28, buffer.sampleRate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    put(36, 'data');
    v.setUint32(40, n * 2, true);
    const s = buffer.getChannelData(0);
    for (let i = 0; i < n; i++)
      v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s[i])) * 32767, true);
    return new Blob([data], { type: 'audio/wav' });
  }
  async function improve(asset, start = 0, end = 0) {
    const b = await decode(asset, 44100),
      finish = Math.min(end || b.duration, b.duration),
      length = Math.floor((finish - start) * b.sampleRate);
    if (length < 1) throw Error('Recorte inválido');
    const off = new OfflineAudioContext(1, length, b.sampleRate),
      source = off.createBufferSource();
    source.buffer = b;
    const high = off.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 85;
    const low = off.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 10000;
    const compressor = off.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.ratio.value = 3;
    source.connect(high).connect(low).connect(compressor).connect(off.destination);
    source.start(0, start, finish - start);
    const out = await off.startRendering(),
      s = out.getChannelData(0);
    let peak = 0.001;
    for (let i = 0; i < s.length; i++) {
      if (Math.abs(s[i]) < 0.008) s[i] *= 0.35;
      peak = Math.max(peak, Math.abs(s[i]));
    }
    const gain = Math.min(3, 0.92 / peak);
    for (let i = 0; i < s.length; i++) s[i] *= gain;
    return wav(out);
  }
  async function prepareAudio(project, ac, mix) {
    extraAudio = [];
    if (!ac) return;
    for (const track of project.audioTracks || []) {
      if (track.muted) continue;
      const a = assets.find((a) => a.id === track.asset);
      if (!a) throw Error('Falta una pista de audio');
      const media = new Audio(a.url);
      await new Promise((r, j) => {
        media.onloadeddata = r;
        media.onerror = () => j(Error('Audio no compatible'));
        media.load();
      });
      media.playbackRate = track.speed || 1;
      const source = ac.createMediaElementSource(media),
        gain = ac.createGain();
      gain.gain.value = Math.max(0, Math.min(2, track.volume ?? 1));
      source.connect(gain).connect(mix);
      extraAudio.push({ media, track, gain });
      await media.play();
      media.pause();
      await seekMedia(media, track.sourceStart || 0);
    }
  }
  function syncAudio(project, time, ac) {
    for (const { media, track, gain } of extraAudio) {
      const end =
          track.end ||
          (media.duration - (track.sourceStart || 0)) / (track.speed || 1) + (track.at || 0),
        active = time >= (track.at || 0) && time < end,
        target =
          (track.sourceStart || 0) + Math.max(0, time - (track.at || 0)) * (track.speed || 1);
      if (active) {
        if (Math.abs(media.currentTime - target) > 0.25) media.currentTime = target;
        if (media.paused) media.play().catch(() => {});
      } else media.pause();
      const fade = Math.min(
        1,
        Math.max(0, (time - (track.at || 0)) / 0.06),
        Math.max(0, (end - time) / 0.1),
      );
      gain.gain.setTargetAtTime(active ? (track.volume ?? 1) * fade : 0, ac.currentTime, 0.02);
    }
  }
  function stop() {
    for (const v of videos.values()) v.pause();
    extraAudio.forEach((a) => a.media.pause());
    extraAudio = [];
  }
  async function transcribe(samples, language, progress, signal) {
    asr?.terminate();
    asr = new Worker(new URL('asr-worker.js', document.baseURI), { type: 'module' });
    return new Promise((resolve, reject) => {
      const worker = asr;
      const abort = () => {
        worker.terminate();
        asr = null;
        reject(Error('Transcripción cancelada'));
      };
      signal?.addEventListener('abort', abort, { once: true });
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') progress(data.message);
        else {
          signal?.removeEventListener('abort', abort);
          worker.terminate();
          asr = null;
          if (data.type === 'done') resolve(data.words);
          else reject(Error(data.message));
        }
      };
      worker.onerror = (e) => {
        worker.terminate();
        signal?.removeEventListener('abort', abort);
        reject(Error(e.message || 'No se pudo cargar el modelo de voz'));
      };
      worker.postMessage({ samples, language }, [samples.buffer]);
    });
  }
  async function faces(asset, scene, format, progress, signal) {
    if (!detector) {
      const m =
        await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
      const files = await m.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm',
      );
      detector = await m.FaceDetector.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
        },
        runningMode: 'IMAGE',
      });
    }
    const v = await video(asset),
      duration = Math.min(120, P.length(scene)),
      path = [];
    try {
      const [w, h] = C.dimensions(format, 720),
        scale = Math.max(w / v.videoWidth, h / v.videoHeight);
      let previous = 50;
      for (let t = 0; t < duration; t += 0.5) {
        if (signal?.aborted) throw Error('Seguimiento cancelado');
        await seekMedia(v, (scene.start || 0) + t * (scene.speed || 1));
        const detections = detector.detect(v).detections || [];
        const face = detections.sort(
          (a, b) =>
            b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height,
        )[0];
        if (face) {
          const cx = face.boundingBox.originX + face.boundingBox.width / 2,
            den = w - v.videoWidth * scale;
          const raw = Math.abs(den) < 1 ? 50 : 50 - (100 * (cx - v.videoWidth / 2) * scale) / den;
          previous = previous * 0.4 + Math.max(0, Math.min(100, raw)) * 0.6;
          path.push({ t, x: previous });
        }
        progress('Analizando rostro ' + Math.round((t / duration) * 100) + '%');
      }
      if (!path.length) throw Error('No se encontró un rostro. Ajusta el encuadre manualmente.');
      return path;
    } finally {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
  }
  root.LumaFlowMedia = {
    video,
    prepareScene,
    sync,
    decode,
    wav,
    improve,
    prepareAudio,
    syncAudio,
    stop,
    transcribe,
    faces,
  };
})(globalThis);
