/* Shared Canvas renderer: the preview and exported frames use the same compositor. */
draw = function () {
  const c = $('#canvas'),
    x = p();
  if (!c || !x || rendering) return;
  const media = previewMedia?.readyState >= 2 ? previewMedia : imageObj;
  hitBoxes = paintScene(
    c.getContext('2d'),
    x,
    media,
    previewMedia
      ? Math.max(0, (previewMedia.currentTime - x.start) / (x.speed || 1))
      : singlePreviewRAF
        ? previewSeconds
        : previewSeconds > 0
          ? previewSeconds
          : 1,
  );
  globalThis.LumaFlow?.drawHandles(c);
  const b = hitBoxes.find((b) => b.id === selectedLayer);
  if (b) {
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = c.width / 360;
    ctx.setLineDash([c.width / 90, c.width / 180]);
    ctx.strokeRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);
    ctx.restore();
  }
};
let singlePreviewRAF = 0,
  singleStarted = 0;
function stopSinglePreview() {
  cancelAnimationFrame(singlePreviewRAF);
  singlePreviewRAF = 0;
  previewMedia?.pause();
  previewMusic?.pause();
  globalThis.LumaFlowMedia?.stop();
  if ($('#playBtn')) $('#playBtn').textContent = '▶ Reproducir';
}
togglePreview = async function () {
  if (rendering || !p()) return;
  const x = p(),
    sceneId = x.activeScene,
    canvas = $('#canvas');
  try {
    if ((previewMedia && !previewMedia.paused) || singlePreviewRAF) {
      stopSinglePreview();
      return;
    }
    const duration = P.length(x);
    if (previewMedia) {
      const end = Math.min(x.end || previewMedia.duration, previewMedia.duration);
      if (!Number.isFinite(end) || end <= x.start)
        throw Error('Revisa el inicio y el final del recorte.');
      if (previewMedia.currentTime < x.start || previewMedia.currentTime >= end)
        await seekMedia(previewMedia, x.start);
      previewMedia.muted = !!x.muted;
      previewMedia.playbackRate = x.speed || 1;
      await previewMedia.play();
      previewSeconds = (previewMedia.currentTime - x.start) / (x.speed || 1);
    } else {
      if (previewSeconds >= duration) previewSeconds = 0;
      singleStarted = performance.now() - previewSeconds * 1000;
    }
    if (previewMusic) {
      previewMusic.loop = !!x.musicLoop;
      previewMusic.currentTime =
        previewMusic.loop && Number.isFinite(previewMusic.duration)
          ? previewSeconds % previewMusic.duration
          : Math.min(previewSeconds, previewMusic.duration || previewSeconds);
      await previewMusic.play();
    }
    $('#playBtn').textContent = 'Ⅱ Pausar';
    function step() {
      if ($('#canvas') !== canvas || p() !== x || x.activeScene !== sceneId || rendering) {
        stopSinglePreview();
        return;
      }
      const end = previewMedia
        ? Math.min(x.end || previewMedia.duration, previewMedia.duration)
        : duration;
      let t = previewMedia
        ? (previewMedia.currentTime - x.start) / (x.speed || 1)
        : (performance.now() - singleStarted) / 1000;
      const ended = previewMedia
        ? previewMedia.currentTime >= end || previewMedia.paused
        : t >= duration;
      t = Math.max(0, Math.min(duration, t));
      previewSeconds = t;
      const seek = $('#seek'),
        time = $('#time');
      if (seek) seek.value = previewMedia ? Math.min(end, previewMedia.currentTime) : t;
      if (time) time.textContent = t.toFixed(1) + ' / ' + duration.toFixed(1) + ' s';
      if (ended) stopSinglePreview();
      draw();
      if (!ended) singlePreviewRAF = requestAnimationFrame(step);
    }
    singlePreviewRAF = requestAnimationFrame(step);
  } catch (e) {
    stopSinglePreview();
    toast(e.message);
  }
};
async function preloadSequence(project) {
  const result = [],
    lookup = new Map(assets.map((a) => [a.id, a]));
  for (const s of project.scenes) {
    if (abortExport) throw Error('Operación cancelada');
    C.parseSRT(s.subtitles || '');
    let media = null;
    const a = lookup.get(s.asset);
    if (s.asset && !a) throw Error('Falta el archivo de ' + s.name + '. Vuelve a importarlo.');
    if (a && /^(video|audio)/.test(a.type)) {
      media = document.createElement(a.type.startsWith('audio') ? 'audio' : 'video');
      media.playsInline = true;
      media.preload = 'auto';
      const loaded = waitMedia(media, 'loadeddata', 25000);
      media.src = a.url;
      media.load();
      await loaded;
      if (!Number.isFinite(media.duration)) await seekMedia(media, 10000000);
      s.sourceDuration = media.duration;
      media.playbackRate = s.speed || 1;
      media.preservesPitch = true;
      const end = s.end || media.duration;
      if (s.start >= end || s.start < 0 || end > media.duration + 0.08)
        throw Error('Revisa el recorte de ' + s.name);
      await seekMedia(media, s.start);
    } else if (a?.type.startsWith('image')) {
      media = new Image();
      await new Promise((resolve, reject) => {
        media.onload = resolve;
        media.onerror = () => reject(Error('Imagen no compatible en ' + s.name));
        media.src = a.url;
      });
    } else if (a) throw Error('Selecciona una imagen o video en ' + s.name);
    for (const l of s.layers || []) {
      if (l.kind !== 'image' || !l.asset || assetImages.has(l.asset)) continue;
      const asset = lookup.get(l.asset);
      if (!asset) throw Error('Falta una imagen de capa');
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(Error('Capa de imagen no compatible'));
        img.src = asset.url;
      });
      assetImages.set(l.asset, img);
    }
    await globalThis.LumaFlowMedia?.prepareScene(s);
    result.push(media);
  }
  return result;
}
function recordType() {
  return recorderType();
}
async function runSequence(project, options = {}) {
  if (rendering) throw Error('Ya hay un proceso en curso');
  P.ensure(project);
  P.mirror(project);
  const snapshot = structuredClone(project),
    canvas = $('#canvas');
  if (!canvas) throw Error('Abre el proyecto en el editor.');
  let recorder,
    stream,
    ac,
    music,
    resources = [],
    audioGains = [],
    mix,
    destination,
    analyser,
    monitorOutput,
    animation = 0,
    oldWidth = canvas.width,
    currentIndex = -1,
    output = null;
  const record = options.record !== false;
  rendering = true;
  abortExport = false;
  previewSequence = !record;
  previewMedia?.pause();
  previewMusic?.pause();
  musicPreview?.pause();
  cancelAnimationFrame(frameId);
  cancelAnimationFrame(singlePreviewRAF);
  singlePreviewRAF = 0;
  let disabled = [];
  const status = $('#exportStatus');
  status.innerHTML =
    '<div class="export-progress"><strong>Preparando ' +
    (record ? 'montaje' : 'vista previa') +
    '…</strong><progress max="100" value="0"></progress><button onclick="abortExport=true">Cancelar</button></div>';
  try {
    disabled = [
      ...document.querySelectorAll(
        '.creator-workspace input,.creator-workspace select,.creator-workspace textarea,.creator-workspace button,.editor-bottom input,.editor-bottom textarea,.editor-bottom button,main > .actions button',
      ),
    ].filter((el) => !el.disabled);
    disabled.forEach((el) => (el.disabled = true));
    resources = await preloadSequence(snapshot);
    const timing = P.layout(snapshot.scenes),
      duration = timing.at(-1).end;
    if (duration > 120) throw Error('El montaje supera 120 segundos. Acorta o divide las escenas.');
    if (duration <= 0) throw Error('No hay contenido para exportar.');
    const quality = Number($('#quality')?.value) || 720;
    [canvas.width, canvas.height] = C.dimensions(snapshot.format, quality);
    const ctx = canvas.getContext('2d'),
      aCanvas = document.createElement('canvas'),
      bCanvas = document.createElement('canvas');
    aCanvas.width = bCanvas.width = canvas.width;
    aCanvas.height = bCanvas.height = canvas.height;
    const aCtx = aCanvas.getContext('2d'),
      bCtx = bCanvas.getContext('2d');
    const audioAsset = assets.find((a) => a.id === snapshot.audio);
    if (snapshot.audio && !audioAsset)
      throw Error('Falta la pista musical. Vuelve a seleccionarla.');
    if (
      snapshot.audioTracks?.length ||
      audioAsset ||
      resources.some((m) => m instanceof HTMLMediaElement)
    ) {
      ac = new AudioContext();
      await ac.resume();
      mix = ac.createGain();
      const compressor = ac.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.ratio.value = 4;
      mix.connect(compressor);
      destination = ac.createMediaStreamDestination();
      compressor.connect(destination);
      if (!record) monitorOutput = compressor;
      analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      for (let i = 0; i < resources.length; i++) {
        const media = resources[i];
        if (!(media instanceof HTMLMediaElement)) {
          audioGains[i] = null;
          continue;
        }
        const source = ac.createMediaElementSource(media),
          gain = ac.createGain();
        gain.gain.value = snapshot.scenes[i].muted ? 0 : (snapshot.volume ?? 1);
        source.connect(gain).connect(mix);
        gain.connect(analyser);
        audioGains[i] = gain;
      }
      if (audioAsset) {
        music = new Audio();
        music.preload = 'auto';
        const loaded = waitMedia(music, 'loadeddata', 25000);
        music.src = audioAsset.url;
        music.load();
        await loaded;
        music.loop = !!snapshot.musicLoop;
        const source = ac.createMediaElementSource(music),
          gain = ac.createGain();
        gain.gain.value = snapshot.musicVolume ?? 0.35;
        source.connect(gain).connect(mix);
        music._gain = gain;
      }
    }
    await globalThis.LumaFlowMedia?.prepareAudio(snapshot, ac, mix);
    function paint(t) {
      const i = P.locate(t, timing),
        scene = snapshot.scenes[i],
        local = Math.max(0, t - timing[i].start),
        media = resources[i];
      if (i !== currentIndex) {
        if (currentIndex >= 0 && resources[currentIndex] instanceof HTMLMediaElement)
          resources[currentIndex].pause();
        currentIndex = i;
        if (media instanceof HTMLMediaElement) {
          media.playbackRate = scene.speed || 1;
          media.preservesPitch = true;
          media.currentTime = scene.start;
          media.play().catch(() => {
            abortExport = true;
          });
        }
      }
      globalThis.LumaFlowMedia?.sync(scene, local, true);
      globalThis.LumaFlowMedia?.syncAudio(snapshot, t, ac);
      paintScene(bCtx, scene, media, local);
      const transition = scene.transition;
      if (i > 0 && local < 0.35 && transition !== 'cut') {
        paintScene(aCtx, snapshot.scenes[i - 1], resources[i - 1], timing[i - 1].duration - 0.001);
        const amount = Math.min(1, local / 0.35);
        ctx.drawImage(aCanvas, 0, 0);
        ctx.save();
        if (transition === 'fade') ctx.globalAlpha = amount;
        if (transition === 'slide') ctx.translate((1 - amount) * canvas.width, 0);
        if (transition === 'zoom') {
          ctx.globalAlpha = amount;
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.scale(0.8 + 0.2 * amount, 0.8 + 0.2 * amount);
          ctx.translate(-canvas.width / 2, -canvas.height / 2);
        }
        ctx.drawImage(bCanvas, 0, 0);
        ctx.restore();
      } else ctx.drawImage(bCanvas, 0, 0);
      if (music?._gain && ac) {
        let gain = snapshot.musicVolume ?? 0.35;
        if (snapshot.ducking && analyser) {
          const data = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(data);
          const rms = Math.sqrt(
            data.reduce((sum, n) => sum + Math.pow((n - 128) / 128, 2), 0) / data.length,
          );
          if (rms > 0.025) gain *= 0.28;
        }
        gain *= Math.min(1, t / 0.25, (duration - t) / 0.35);
        music._gain.gain.setTargetAtTime(Math.max(0, gain), ac.currentTime, 0.08);
      }
      return i;
    }
    await Promise.all(
      resources.map(async (media, i) => {
        if (media instanceof HTMLMediaElement) {
          await media.play();
          media.pause();
          await seekMedia(media, snapshot.scenes[i].start);
        }
      }),
    );
    if (music) {
      await music.play();
      music.pause();
      await seekMedia(music, 0);
    }
    if (abortExport) throw Error('Proceso cancelado');
    monitorOutput?.connect(ac.destination);
    paint(0);
    const chunks = [];
    let finished;
    if (record) {
      const mime = recordType();
      if (!mime) throw Error('No hay un formato de video compatible.');
      stream = canvas.captureStream(30);
      destination?.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: quality === 1080 ? 8000000 : 4500000,
      });
      finished = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = (e) => reject(e.error || Error('El codificador falló'));
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
      });
      recorder.start(200);
    }
    if (music)
      music.play().catch(() => {
        abortExport = true;
      });
    const started = performance.now();
    await new Promise((resolve, reject) => {
      function step(now) {
        if (abortExport) return resolve();
        try {
          const t = Math.min(duration, (now - started) / 1000);
          paint(t);
          const percent = Math.round((t / duration) * 100);
          status.querySelector('strong').textContent =
            (record ? 'Exportando' : 'Reproduciendo') +
            ' escena ' +
            (currentIndex + 1) +
            '/' +
            snapshot.scenes.length +
            ' · ' +
            percent +
            '%';
          status.querySelector('progress').value = percent;
          if (t >= duration) {
            resolve();
            return;
          }
          animation = requestAnimationFrame(step);
        } catch (e) {
          reject(e);
        }
      }
      animation = requestAnimationFrame(step);
    });
    if (recorder) {
      recorder.stop();
      await finished;
    }
    if (abortExport) throw Error('Proceso cancelado.');
    if (record) {
      const blob = await C.webmDuration(new Blob(chunks, { type: recorder.mimeType }), duration);
      if (blob.size < 100) throw Error('El navegador produjo un archivo vacío');
      const name = project.name + (blob.type.includes('mp4') ? '.mp4' : '.webm');
      output = { blob, name, duration, width: canvas.width, height: canvas.height };
      lastVideo = blob;
      lastVideoName = name;
      if (lastVideoURL) URL.revokeObjectURL(lastVideoURL);
      lastVideoURL = URL.createObjectURL(blob);
      if ($('#exportResult'))
        $('#exportResult').innerHTML =
          '<section class="panel export-result"><h3>Montaje terminado · ' +
          duration.toFixed(1) +
          ' s · ' +
          snapshot.scenes.length +
          ' escenas</h3><video controls src="' +
          lastVideoURL +
          '"></video><div class="actions"><button onclick="download(lastVideo,lastVideoName)">↓ Descargar montaje</button><button onclick="saveFinalVideo()">＋ Guardar en biblioteca</button><button onclick="queueCurrent()">↗ Preparar para redes</button></div></section>';
      if (options.download !== false) download(blob, name);
    }
    return output;
  } finally {
    cancelAnimationFrame(animation);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    globalThis.LumaFlowMedia?.stop();
    resources.forEach((m) => {
      if (m instanceof HTMLMediaElement) {
        m.pause();
        m.removeAttribute('src');
        m.load();
      }
    });
    music?.pause();
    stream?.getTracks().forEach((t) => t.stop());
    if (ac) await ac.close();
    disabled.forEach((el) => (el.disabled = false));
    rendering = false;
    previewSequence = false;
    status.innerHTML = '';
    [canvas.width, canvas.height] = C.dimensions(project.format, oldWidth);
    draw();
  }
}
exportVideo = async function (options = {}) {
  try {
    return await runSequence(p(), options);
  } catch (e) {
    toast(e.message);
    if (options.throwErrors) throw e;
    return null;
  }
};
async function playMontage() {
  try {
    await runSequence(p(), { record: false });
  } catch (e) {
    toast(e.message);
  }
}
exportImage = async function () {
  if (rendering) return;
  try {
    const canvas = $('#canvas');
    if (!canvas) return;
    const old = canvas.width;
    sizeCanvas(1080);
    const media = previewMedia?.readyState >= 2 ? previewMedia : imageObj;
    paintScene(
      canvas.getContext('2d'),
      p(),
      media,
      previewMedia ? Math.max(0, (previewMedia.currentTime - p().start) / (p().speed || 1)) : 1,
    );
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) download(blob, p().name + '.png');
    sizeCanvas(old);
    draw();
  } catch (e) {
    toast(e.message);
  }
};
async function carouselFiles(project) {
  if (rendering) throw Error('Termina el proceso en curso.');
  abortExport = false;
  rendering = true;
  P.mirror(project);
  const clone = structuredClone(project),
    canvas = document.createElement('canvas');
  let resources = [];
  try {
    resources = await preloadSequence(clone);
    [canvas.width, canvas.height] = C.dimensions(project.format, 1080);
    const files = [];
    for (let i = 0; i < clone.scenes.length; i++) {
      if (abortExport) throw Error('Proceso cancelado');
      paintScene(canvas.getContext('2d'), clone.scenes[i], resources[i], 1);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw Error('No se pudo crear una diapositiva');
      files.push({ name: 'slide-' + String(i + 1).padStart(2, '0') + '.png', blob });
    }
    return files;
  } finally {
    resources.forEach((m) => m?.pause?.());
    rendering = false;
    draw();
  }
}

async function exportCarousel() {
  if (rendering) return;
  try {
    toast('Preparando las diapositivas…');
    const files = await carouselFiles(p());
    files.push({ name: 'descripcion.txt', blob: new Blob([p().caption], { type: 'text/plain' }) });
    download(await P.zip(files), p().name + '-carrusel.zip');
    toast('Carrusel exportado con todas las escenas.');
  } catch (e) {
    toast(e.message);
  }
}
