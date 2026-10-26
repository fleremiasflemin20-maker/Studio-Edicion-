/* Luma Studio v2: rendering, portable backups and creator tools. */
const C = LumaCore,
  oldRender = render,
  oldGo = go;
views.push(['code', '⌘', 'Código creativo'], ['tools', '◉', 'Herramientas']);
$('nav').innerHTML = views
  .map(
    ([id, icon, title]) =>
      '<button data-view="' +
      id +
      '" onclick="go(\'' +
      id +
      '\')">' +
      icon +
      ' &nbsp; ' +
      title +
      '</button>',
  )
  .join('');
let lastVideo = null,
  lastVideoName = '',
  lastVideoURL = null,
  rendering = false,
  abortExport = false,
  frameId = 0,
  previewMedia = null,
  previewMusic = null,
  subs = [],
  history = [],
  future = [],
  historyTimer,
  labBusy = false;
projects.forEach((x) => {
  const defaults = C.normalize(x);
  Object.keys(defaults).forEach((k) => {
    if (x[k] === undefined) x[k] = defaults[k];
  });
});
go = function (v) {
  if (rendering || labBusy) {
    toast('Termina o cancela la exportación antes de cambiar de sección.');
    return;
  }
  cancelAnimationFrame(frameId);
  previewMedia?.pause();
  previewMusic?.pause();
  oldGo(v);
};
render = function () {
  oldRender();
  if (view === 'code') renderCode();
  if (view === 'tools') renderTools();
  if (view === 'projects')
    $('.toolbar').insertAdjacentHTML(
      'beforeend',
      '<button onclick="importBackup()">↥ Importar proyecto / respaldo</button><button onclick="backupAll()">↓ Respaldo completo</button>',
    );
  if (view === 'home')
    $('.note').insertAdjacentHTML(
      'beforebegin',
      '<div class="feature-strip"><button onclick="go(\'code\')">⌘ Código creativo <small>Crea títulos y animaciones con código</small></button><button onclick="go(\'tools\')">◉ Herramientas del creador <small>Teleprompter · checklist · respaldo</small></button></div>',
    );
};
function remember() {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    if (!p()) return;
    const s = JSON.stringify(p());
    if (history.at(-1) !== s) {
      history.push(s);
      if (history.length > 40) history.shift();
      future = [];
    }
  }, 350);
}
function undo() {
  clearTimeout(historyTimer);
  if (!p()) return;
  const now = JSON.stringify(p());
  if (history.at(-1) === now) history.pop();
  if (!history.length) return toast('No hay cambios anteriores.');
  future.push(now);
  Object.assign(p(), JSON.parse(history.pop()));
  save();
  renderEditor();
}
function redo() {
  if (!future.length) return;
  history.push(JSON.stringify(p()));
  Object.assign(p(), JSON.parse(future.pop()));
  save();
  renderEditor();
}
const openBefore = openProject;
openProject = function (id) {
  history = [];
  future = [];
  openBefore(id);
  remember();
};
function field(id, label, value, type = 'text', attrs = '') {
  return (
    '<label for="' +
    id +
    '">' +
    label +
    '</label><input id="' +
    id +
    '" type="' +
    type +
    '" value="' +
    esc(value) +
    '" ' +
    attrs +
    '>'
  );
}
renderEditor = function () {
  cancelAnimationFrame(frameId);
  previewMedia?.pause();
  previewMusic?.pause();
  previewMedia = null;
  previewMusic = null;
  const x = p();
  if (!x) {
    $('main').innerHTML =
      intro('Tu próximo contenido empieza aquí.', 'Crea un proyecto o continúa uno existente.') +
      cards(projects);
    return;
  }
  if (history.length && JSON.parse(history.at(-1)).id !== x.id) {
    history = [];
    future = [];
  }
  if (!history.length) history.push(JSON.stringify(x));
  const a = assets.find((a) => a.id === x.asset);
  const video = a && /^(video|audio)/.test(a.type);
  subs = [];
  try {
    subs = C.parseSRT(x.subtitles || '');
  } catch {}
  $('main').innerHTML =
    intro(esc(x.name), 'Editor · ' + esc(x.platform) + ' · ' + esc(x.format)) +
    '<div class="actions"><button onclick="go(\'projects\')">← Proyectos</button><button onclick="undo()">↶ Deshacer</button><button onclick="redo()">↷ Rehacer</button><button onclick="downloadProject()">↓ Proyecto completo</button><button onclick="exportImage()">↓ PNG</button><button class="primary" id="exportButton" onclick="exportVideo()">↓ Exportar video</button><button onclick="duplicate()">Duplicar</button><button class="danger" onclick="deleteProject()">Eliminar</button></div><div id="exportStatus" role="status"></div><div id="exportResult"></div><div class="editor"><section class="panel"><h3>◫ Diseño y contenido</h3><label for="overlay">Texto superpuesto</label><textarea id="overlay">' +
    esc(x.text) +
    '</textarea><label for="ratio">Formato</label><select id="ratio">' +
    ['9:16', '1:1', '16:9', '4:5']
      .map((r) => '<option ' + (r === x.format ? 'selected' : '') + '>' + r + '</option>')
      .join('') +
    '</select>' +
    field('bg', 'Color de fondo', x.bg, 'color') +
    field('color', 'Color del texto', x.color, 'color') +
    field('fontSize', 'Tamaño del texto', x.fontSize, 'range', 'min="20" max="140"') +
    field('textY', 'Posición vertical del texto (%)', x.textY ?? 50, 'range', 'min="10" max="90"') +
    field('brightness', 'Brillo', x.brightness, 'range', 'min="20" max="180"') +
    field('saturation', 'Saturación', x.saturation, 'range', 'min="0" max="200"') +
    '<label for="asset">Imagen o video</label><select id="asset"><option value="">Solo fondo</option>' +
    assets
      .filter((a) => !a.type.startsWith('audio'))
      .map(
        (a) =>
          '<option value="' +
          a.id +
          '" ' +
          (x.asset === a.id ? 'selected' : '') +
          '>' +
          esc(a.name) +
          '</option>',
      )
      .join('') +
    '</select><button style="margin-top:12px" onclick="importFiles()">＋ Importar archivo</button></section><section><div class="stage v2stage"><canvas id="canvas" aria-label="Vista previa del contenido"></canvas><div id="safeGuide" class="safe-guide" hidden>Zona de texto recomendada</div></div><div class="actions"><button id="playBtn" onclick="togglePreview()">▶ Reproducir</button><button onclick="toggleGuide()">▣ Guías</button><select id="quality" aria-label="Calidad de exportación"><option value="720">720p · rápido</option><option value="1080">1080p · alta calidad</option></select></div><input type="range" id="seek" aria-label="Posición de reproducción" min="0" max="120" step=".05" value="0" style="width:100%"><p id="time" class="hint">00:00</p><div class="notice">Exporta el recorte con filtros, texto, subtítulos y audio. Se procesa en tiempo real: mantén esta pestaña visible. Formato disponible según tu navegador: WebM o MP4. Máximo 120 segundos por exportación.</div></section><section class="panel"><h3>Preparar publicación</h3>' +
    field('editName', 'Título', x.name) +
    '<label for="caption">Descripción y hashtags</label><textarea id="caption">' +
    esc(x.caption) +
    '</textarea><p id="chars" class="hint">' +
    x.caption.length +
    ' caracteres</p><label for="status">Estado</label><select id="status"><option ' +
    (x.status === 'Borrador' ? 'selected' : '') +
    '>Borrador</option><option ' +
    (x.status === 'Listo' ? 'selected' : '') +
    '>Listo</option></select>' +
    field('date', 'Fecha de planificación', x.date, 'datetime-local') +
    '<button style="margin-top:12px" onclick="copyCaption()">Copiar descripción</button><button style="margin-top:8px" onclick="exportICS()">↓ Evento de calendario</button><div class="notice">Planifica en tu calendario. La app no envía publicaciones a las redes.</div><h3>Audio</h3><label for="audio">Música / voz importada</label><select id="audio"><option value="">Sin pista adicional</option>' +
    assets
      .filter((a) => a.type.startsWith('audio'))
      .map(
        (a) =>
          '<option value="' +
          a.id +
          '" ' +
          (x.audio === a.id ? 'selected' : '') +
          '>' +
          esc(a.name) +
          '</option>',
      )
      .join('') +
    '</select>' +
    field('volume', 'Volumen original', x.volume ?? 1, 'range', 'min="0" max="1" step=".05"') +
    field(
      'musicVolume',
      'Volumen de pista adicional',
      x.musicVolume ?? 0.35,
      'range',
      'min="0" max="1" step=".05"',
    ) +
    '</section></div><div class="ideas editor-bottom"><section class="panel"><h3>✂ Recorte y duración</h3><div class="trim-fields">' +
    field('start', 'Inicio del original (s)', x.start, 'number', 'min="0" step=".1"') +
    field('end', 'Final del original (s; 0 = completo)', x.end, 'number', 'min="0" step=".1"') +
    field(
      'duration',
      'Duración para imágenes (s)',
      x.duration ?? 6,
      'number',
      'min="1" max="120" step=".5"',
    ) +
    '</div><p class="hint">Los tiempos de subtítulos empiezan en 0 al inicio del fragmento exportado.</p><div class="actions"><button onclick="mark(\'start\')">Marcar inicio actual</button><button onclick="mark(\'end\')">Marcar final actual</button></div><h3>Control antes de publicar</h3>' +
    checklistHTML(x) +
    '</section><section class="panel"><h3>Subtítulos editables · SRT</h3><label for="subtitleText">Subtítulos con tiempos</label><textarea id="subtitleText" class="code-text" style="height:190px" placeholder="1&#10;00:00:00,000 --> 00:00:03,000&#10;Tu primera frase">' +
    esc(x.subtitles || '') +
    '</textarea><div class="actions"><button onclick="importSRT()">↥ Importar SRT</button><button onclick="saveSRT()">↓ Descargar SRT</button><button onclick="makeCaptions()">Distribuir líneas</button></div><label for="captionLines">Una frase por línea para distribuirlas en el fragmento</label><textarea id="captionLines" placeholder="Primera frase&#10;Segunda frase"></textarea><p id="subError" class="hint">Los subtítulos se dibujan en el video exportado. No hay transcripción automática.</p></section></div>';
  const map = {
    overlay: 'text',
    ratio: 'format',
    bg: 'bg',
    color: 'color',
    fontSize: 'fontSize',
    textY: 'textY',
    brightness: 'brightness',
    saturation: 'saturation',
    asset: 'asset',
    editName: 'name',
    caption: 'caption',
    status: 'status',
    date: 'date',
    audio: 'audio',
    volume: 'volume',
    musicVolume: 'musicVolume',
    start: 'start',
    end: 'end',
    duration: 'duration',
    subtitleText: 'subtitles',
  };
  const nums = [
    'fontSize',
    'textY',
    'brightness',
    'saturation',
    'volume',
    'musicVolume',
    'start',
    'end',
    'duration',
  ];
  Object.entries(map).forEach(
    ([id, key]) =>
      ($('#' + id).oninput = (e) => {
        if (rendering) return;
        x[key] = nums.includes(key) ? Number(e.target.value) : e.target.value;
        save();
        remember();
        if (id === 'asset' || id === 'audio') {
          renderEditor();
          return;
        }
        if (id === 'caption') $('#chars').textContent = x.caption.length + ' caracteres';
        if (id === 'editName') $('h1').textContent = x.name;
        if (id === 'subtitleText') validateSubs();
        if (id === 'ratio') sizeCanvas();
        if (previewMedia) previewMedia.volume = x.volume;
        if (previewMusic) previewMusic.volume = x.musicVolume;
        draw();
      }),
  );
  $('#seek').oninput = (e) => {
    if (rendering) return;
    if (previewMedia) previewMedia.currentTime = +e.target.value;
    else previewSeconds = +e.target.value;
    draw();
  };
  const music = assets.find((a) => a.id === x.audio);
  if (music) {
    previewMusic = new Audio(music.url);
    previewMusic.volume = x.musicVolume;
  }
  imageObj = null;
  const token = ++loadToken;
  if (video) {
    const v = document.createElement('video');
    previewMedia = v;
    v.src = a.url;
    v.playsInline = true;
    v.preload = 'auto';
    v.volume = x.volume;
    v.onloadeddata = async () => {
      if (token !== loadToken) return;
      try {
        if (!Number.isFinite(v.duration)) {
          await seekMedia(v, 10000000);
          await seekMedia(v, x.start);
        } else await seekMedia(v, Math.min(x.start, v.duration));
        if (token !== loadToken) return;
        $('#seek').max = v.duration;
        draw();
      } catch (e) {
        toast(e.message);
      }
    };
    v.onerror = () => toast('El navegador no puede decodificar este video. Prueba un MP4 H.264.');
    v.ontimeupdate = () => {
      if (!$('#seek')) return;
      $('#seek').value = v.currentTime;
      $('#time').textContent = v.currentTime.toFixed(1) + ' / ' + v.duration.toFixed(1) + ' s';
      if (!rendering && v.currentTime >= (x.end || v.duration)) {
        v.pause();
        previewMusic?.pause();
      }
    };
  } else if (a) {
    const i = new Image();
    i.onload = () => {
      if (token !== loadToken) return;
      imageObj = i;
      draw();
    };
    i.onerror = () => toast('No se pudo abrir la imagen');
    i.src = a.url;
  }
  sizeCanvas();
  previewSeconds = 0;
  $('#seek').max = video ? 120 : x.duration;
  validateSubs();
  draw();
};
let loadToken = 0,
  previewSeconds = 0;
function sizeCanvas(width = 720) {
  const c = $('#canvas');
  if (!c || !p()) return;
  [c.width, c.height] = C.dimensions(p().format, width);
}
function wrapText(ctx, text, max) {
  const lines = [];
  String(text)
    .split('\n')
    .forEach((line) => {
      let t = '';
      for (const word of line.split(' ')) {
        if (ctx.measureText(t + ' ' + word).width > max && t) {
          lines.push(t);
          t = word;
        } else t += (t ? ' ' : '') + word;
      }
      lines.push(t);
    });
  return lines;
}
draw = function () {
  const c = $('#canvas'),
    x = p();
  if (!c || !x) return;
  const ctx = c.getContext('2d'),
    w = c.width,
    h = c.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = x.bg;
  ctx.fillRect(0, 0, w, h);
  const media = previewMedia?.readyState >= 2 ? previewMedia : imageObj;
  if (media) {
    const mw = media.videoWidth || media.width,
      mh = media.videoHeight || media.height,
      scale = Math.max(w / mw, h / mh);
    ctx.save();
    ctx.filter = 'brightness(' + x.brightness + '%) saturate(' + x.saturation + '%)';
    ctx.drawImage(media, (w - mw * scale) / 2, (h - mh * scale) / 2, mw * scale, mh * scale);
    ctx.restore();
  }
  const fs = (x.fontSize * w) / 1080;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 ' + fs + 'px sans-serif';
  ctx.fillStyle = x.color;
  ctx.shadowColor = '#0008';
  ctx.shadowBlur = fs / 8;
  const lines = wrapText(ctx, x.text, w * 0.84);
  lines.forEach((l, i) =>
    ctx.fillText(l, w / 2, (h * (x.textY ?? 50)) / 100 + (i - (lines.length - 1) / 2) * fs * 1.25),
  );
  ctx.shadowBlur = 0;
  const time = previewMedia ? Math.max(0, previewMedia.currentTime - x.start) : previewSeconds;
  const active = subs.filter((s) => time >= s.start && time < s.end);
  if (active.length) {
    const sfs = w * 0.045;
    ctx.font = '700 ' + sfs + 'px sans-serif';
    const sl = wrapText(ctx, active.map((s) => s.text).join('\n'), w * 0.82);
    sl.slice(0, 6).forEach((l, i) => {
      const yy = h * 0.8 + i * sfs * 1.3;
      ctx.fillStyle = '#15121be6';
      const tw = ctx.measureText(l).width;
      ctx.fillRect((w - tw) / 2 - sfs * 0.35, yy - sfs * 0.65, tw + sfs * 0.7, sfs * 1.3);
      ctx.fillStyle = 'white';
      ctx.fillText(l, w / 2, yy);
    });
  }
};
function validateSubs() {
  try {
    subs = C.parseSRT(p().subtitles || '');
    $('#subError').textContent = subs.length + ' bloques válidos · tiempos relativos al fragmento.';
    return true;
  } catch (e) {
    subs = [];
    $('#subError').textContent = e.message;
    return false;
  }
}
function tick() {
  draw();
  if (previewMedia && !previewMedia.paused) frameId = requestAnimationFrame(tick);
}
async function togglePreview() {
  if (rendering) return;
  try {
    if (previewMedia) {
      if (!previewMedia.paused) {
        previewMedia.pause();
        previewMusic?.pause();
        $('#playBtn').textContent = '▶ Reproducir';
        return;
      }
      const x = p(),
        end = x.end || previewMedia.duration;
      if (previewMedia.currentTime >= end || previewMedia.currentTime < x.start)
        previewMedia.currentTime = x.start;
      if (previewMusic) {
        previewMusic.currentTime = Math.max(0, previewMedia.currentTime - x.start);
        previewMusic.play().catch(() => {});
      }
      await previewMedia.play();
      $('#playBtn').textContent = 'Ⅱ Pausar';
      tick();
    } else {
      previewSeconds = 0;
      draw();
      toast('La imagen se convertirá en un video al exportar.');
    }
  } catch (e) {
    toast('No se pudo reproducir: ' + e.message);
  }
}
function toggleGuide() {
  $('#safeGuide').hidden = !$('#safeGuide').hidden;
}
mark = function (k) {
  if (!previewMedia) return toast('Selecciona un video primero.');
  p()[k] = Math.round(previewMedia.currentTime * 10) / 10;
  $('#' + k).value = p()[k];
  save();
  remember();
};
function durationOf() {
  const x = p();
  if (previewMedia) {
    if (!Number.isFinite(previewMedia.duration)) throw Error('Espera a que cargue el video.');
    const end = x.end || previewMedia.duration;
    if (x.start < 0 || end > previewMedia.duration + 0.1 || end <= x.start)
      throw Error('Revisa el inicio y el final del recorte.');
    return end - x.start;
  }
  if (!(x.duration >= 1 && x.duration <= 120))
    throw Error('La duración debe estar entre 1 y 120 segundos.');
  return x.duration;
}
function makeCaptions() {
  try {
    const t = $('#captionLines').value;
    if (!t.trim()) return toast('Escribe una frase por línea.');
    p().subtitles = C.captions(t, durationOf());
    $('#subtitleText').value = p().subtitles;
    validateSubs();
    save();
    remember();
    draw();
  } catch (e) {
    toast(e.message);
  }
}
function saveSRT() {
  if (validateSubs())
    download(new Blob([p().subtitles], { type: 'text/plain;charset=utf-8' }), p().name + '.srt');
}
function chooseFile(accept, fn) {
  const f = document.createElement('input');
  f.type = 'file';
  f.accept = accept;
  f.onchange = async () => {
    if (f.files[0])
      try {
        await fn(f.files[0]);
      } catch (e) {
        toast(e.message);
      }
  };
  f.click();
}
function importSRT() {
  chooseFile('.srt,text/plain', async (f) => {
    if (f.size > 1000000) throw Error('SRT demasiado grande');
    const t = await f.text();
    C.parseSRT(t);
    p().subtitles = t;
    $('#subtitleText').value = t;
    validateSubs();
    save();
    remember();
    draw();
  });
}
exportImage = async function () {
  try {
    if (rendering) return;
    if (!$('#canvas')) return;
    await document.fonts.ready;
    const old = $('#canvas').width;
    sizeCanvas(1080);
    draw();
    await new Promise((resolve) =>
      $('#canvas').toBlob((b) => {
        if (b) download(b, p().name + '.png');
        resolve();
      }, 'image/png'),
    );
    sizeCanvas(old);
    draw();
  } catch (e) {
    toast('No se pudo exportar: ' + e.message);
  }
};
function waitMedia(el, event, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(Error('El archivo tardó demasiado en cargar.')), timeout);
    const ok = () => done(),
      bad = () => done(Error('No se pudo decodificar el archivo.'));
    function done(e) {
      clearTimeout(timer);
      el.removeEventListener(event, ok);
      el.removeEventListener('error', bad);
      e ? reject(e) : resolve();
    }
    el.addEventListener(event, ok, { once: true });
    el.addEventListener('error', bad, { once: true });
  });
}
async function seekMedia(v, t) {
  if (Math.abs(v.currentTime - t) < 0.01 && v.readyState >= 2) return;
  const promise = waitMedia(v, 'seeked');
  v.currentTime = t;
  await promise;
}
function recorderType() {
  if (!window.MediaRecorder)
    throw Error(
      'Tu navegador no tiene exportación de video. Usa una versión reciente de Chrome, Edge o Firefox.',
    );
  return (
    [
      'video/mp4;codecs=avc1.42001f,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find((t) => MediaRecorder.isTypeSupported(t)) || ''
  );
}
async function exportVideo() {
  if (rendering) return;
  let recorder,
    stream,
    ac,
    oldTime = previewMedia?.currentTime || 0,
    oldWidth = $('#canvas')?.width || 720,
    chunks = [];
  try {
    if (!validateSubs()) throw Error('Corrige los tiempos de los subtítulos antes de exportar.');
    const duration = durationOf();
    if (duration > 120) throw Error('Selecciona un fragmento de hasta 120 segundos.');
    const type = recorderType();
    if (!type) throw Error('No se encontró un formato de video compatible.');
    const x = p(),
      v = previewMedia,
      music = previewMusic;
    rendering = true;
    abortExport = false;
    cancelAnimationFrame(frameId);
    v?.pause();
    music?.pause();
    $('#exportStatus').innerHTML =
      '<div class="export-progress"><strong>Preparando exportación…</strong><progress max="100" value="0"></progress><button onclick="abortExport=true">Cancelar</button></div>';
    document
      .querySelectorAll(
        '.editor input,.editor textarea,.editor select,.editor-bottom input,.editor-bottom textarea,.editor-bottom button,.actions button,#quality,#seek',
      )
      .forEach((el) => (el.disabled = true));
    sizeCanvas(+$('#quality').value);
    if (v) await seekMedia(v, x.start);
    previewSeconds = 0;
    draw();
    stream = $('#canvas').captureStream(30);
    let audioToStart = [];
    if (v || music) {
      ac = new AudioContext();
      await ac.resume();
      const dest = ac.createMediaStreamDestination();
      for (const [original, volume, offset] of [
        [v, x.volume, x.start],
        [music, x.musicVolume, 0],
      ]) {
        if (!original) continue;
        const audio = new Audio(original.src);
        audio.preload = 'auto';
        const loaded = waitMedia(audio, 'loadeddata');
        audio.load();
        await loaded;
        await seekMedia(audio, offset);
        const source = ac.createMediaElementSource(audio),
          gain = ac.createGain();
        gain.gain.value = volume ?? 1;
        source.connect(gain).connect(dest);
        audioToStart.push(audio);
        if (original === v) previewExportVoice = audio;
        else previewExportAudio = audio;
      }
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
    recorder = new MediaRecorder(stream, {
      mimeType: type,
      videoBitsPerSecond: +$('#quality').value === 1080 ? 8000000 : 4500000,
    });
    const finished = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = (e) => reject(e.error || Error('Error del codificador'));
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
    });
    recorder.start(250);
    if (v) v.muted = true;
    await Promise.all([...audioToStart.map((a) => a.play()), ...(v ? [v.play()] : [])]);
    const started = performance.now();
    await new Promise((resolve, reject) => {
      function step() {
        if (abortExport) return resolve();
        const elapsed = (performance.now() - started) / 1000;
        previewSeconds = elapsed;
        draw();
        const pct = Math.min(100, Math.round((elapsed / duration) * 100));
        $('#exportStatus strong').textContent =
          'Exportando ' + pct + '% · mantén esta pestaña visible';
        $('#exportStatus progress').value = pct;
        if (v?.error) return reject(Error('Falló la lectura del video.'));
        if (elapsed >= duration) {
          resolve();
          return;
        }
        frameId = requestAnimationFrame(step);
      }
      step();
    });
    recorder.stop();
    await finished;
    if (abortExport) toast('Exportación cancelada');
    else {
      const b = await C.webmDuration(new Blob(chunks, { type: recorder.mimeType }), duration);
      if (!b.size) throw Error('El navegador produjo un archivo vacío.');
      lastVideo = b;
      lastVideoName = x.name + (type.includes('mp4') ? '.mp4' : '.webm');
      if (lastVideoURL) URL.revokeObjectURL(lastVideoURL);
      lastVideoURL = URL.createObjectURL(b);
      $('#exportResult').innerHTML =
        '<section class="panel export-result"><h3>Video terminado · ' +
        (b.size / 1024 / 1024).toFixed(2) +
        ' MB</h3><video controls src="' +
        lastVideoURL +
        '"></video><div class="actions"><button onclick="download(lastVideo,lastVideoName)">↓ Descargar video terminado</button><button onclick="saveFinalVideo()">＋ Guardar en biblioteca</button></div></section>';
      download(b, lastVideoName);
      toast('Video exportado con texto, filtros y subtítulos.');
    }
  } catch (e) {
    toast('Exportación: ' + e.message);
  } finally {
    cancelAnimationFrame(frameId);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    previewExportAudio?.pause();
    previewExportVoice?.pause();
    previewExportAudio = null;
    previewExportVoice = null;
    if (ac) await ac.close();
    if (previewMedia) {
      previewMedia.pause();
      previewMedia.muted = false;
      previewMedia.currentTime = oldTime;
    }
    previewMusic?.pause();
    rendering = false;
    document.querySelectorAll('[disabled]').forEach((el) => (el.disabled = false));
    sizeCanvas(oldWidth);
    draw();
    if ($('#exportStatus')) $('#exportStatus').innerHTML = '';
  }
}
let previewExportAudio = null,
  previewExportVoice = null;

const checks = [
  'El gancho se entiende en los primeros segundos',
  'El texto se lee en pantalla móvil',
  'Los subtítulos están revisados',
  'Tengo derechos sobre la música y las imágenes',
  'La descripción y la llamada a la acción están listas',
  'Revisé la pieza exportada completa',
];
function checklistHTML(x) {
  return checks
    .map(
      (s, i) =>
        '<label class="check"><input type="checkbox" ' +
        (x.checklist?.includes(i) ? 'checked' : '') +
        ' onchange="setCheck(' +
        i +
        ',this.checked)"> ' +
        s +
        '</label>',
    )
    .join('');
}
function setCheck(i, on) {
  p().checklist ??= [];
  p().checklist = p().checklist.filter((n) => n !== i);
  if (on) p().checklist.push(i);
  save();
}
async function storeAsset(blob, name) {
  await ready;
  const a = { id: crypto.randomUUID(), name, type: blob.type, blob };
  await new Promise((resolve, reject) => {
    const t = db.transaction('files', 'readwrite');
    t.objectStore('files').put(a);
    t.oncomplete = resolve;
    t.onerror = () => reject(Error('No hay espacio para guardar el recurso.'));
    t.onabort = () => reject(Error('No se pudo guardar el recurso.'));
  });
  const record = { ...a, url: URL.createObjectURL(blob) };
  assets.push(record);
  return record;
}
function dataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
async function makeBackup(list) {
  await ready;
  const ids = new Set(
    list
      .flatMap((x) => (window.LumaCreatorCore ? LumaCreatorCore.references(x) : [x.asset, x.audio]))
      .filter(Boolean),
  );
  const selected = assets.filter((a) => ids.has(a.id));
  if (selected.reduce((n, a) => n + a.blob.size, 0) > 180 * 1024 * 1024)
    throw Error('El respaldo supera 180 MB. Exporta proyectos por separado.');
  return {
    app: 'luma-studio',
    version: 2,
    projects: list,
    media: await Promise.all(
      selected.map(async (a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        data: await dataURL(a.blob),
      })),
    ),
    notes: localStorage.getItem('luma-notes') || '',
    script: localStorage.getItem('luma-script') || '',
  };
}
downloadProject = async function () {
  try {
    toast('Preparando proyecto con sus archivos…');
    download(
      new Blob([JSON.stringify(await makeBackup([p()]))], { type: 'application/json' }),
      p().name + '.luma.json',
    );
  } catch (e) {
    toast(e.message);
  }
};
async function backupAll() {
  try {
    toast('Preparando respaldo…');
    const b = await makeBackup(projects);
    const referenced = new Set(b.media.map((a) => a.id));
    for (const a of assets) {
      if (!referenced.has(a.id)) {
        if (b.media.reduce((n, a) => n + a.data.length, 0) + a.blob.size * 1.34 > 240 * 1024 * 1024)
          throw Error('La biblioteca es demasiado grande. Exporta por proyecto.');
        b.media.push({ id: a.id, name: a.name, type: a.type, data: await dataURL(a.blob) });
      }
    }
    b.code = localStorage.getItem('luma-code') || '';
    download(
      new Blob([JSON.stringify(b)], { type: 'application/json' }),
      'Luma-respaldo-' + new Date().toISOString().slice(0, 10) + '.json',
    );
    toast('Respaldo descargado');
  } catch (e) {
    toast(e.message);
  }
}
function decodeMedia(a) {
  if (!a || typeof a.id !== 'string' || typeof a.name !== 'string' || typeof a.data !== 'string')
    throw Error('Archivo multimedia no válido.');
  const m = a.data.match(
    /^data:((?:image|video|audio)\/[a-z0-9.+-]+)(?:;[a-z0-9=., -]+)?;base64,([A-Za-z0-9+/=\r\n]*)$/i,
  );
  if (!m) throw Error('Formato multimedia no válido en el respaldo.');
  const type = m[1],
    binary = atob(m[2]);
  if (binary.length > 180 * 1024 * 1024) throw Error('Recurso demasiado grande.');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return {
    old: a.id,
    id: crypto.randomUUID(),
    name: a.name.slice(0, 250),
    type,
    blob: new Blob([bytes], { type }),
  };
}

function importBackup() {
  chooseFile('.json', async (f) => {
    if (f.size > 250 * 1024 * 1024) throw Error('Respaldo demasiado grande (máximo 250 MB).');
    await ready;
    const b = JSON.parse(await f.text());
    if (!b.app && b.name) {
      const x = C.normalize(b);
      projects.unshift(x);
      save();
      toast('Proyecto antiguo importado; vuelve a seleccionar sus archivos.');
      current = x.id;
      go('editor');
      return;
    }
    if (
      b.app !== 'luma-studio' ||
      b.version !== 2 ||
      !Array.isArray(b.projects) ||
      !Array.isArray(b.media) ||
      b.projects.length > 1000 ||
      b.media.length > 1000
    )
      throw Error('Este archivo no es un respaldo de Luma Studio v2.');
    const normalized = b.projects.map(C.normalize),
      records = b.media.map(decodeMedia),
      ids = new Map(records.map((a) => [a.old, a.id]));
    if (ids.size !== records.length)
      throw Error('El respaldo contiene identificadores duplicados.');
    normalized.forEach((x, i) => {
      x.asset = b.projects[i].asset;
      x.audio = b.projects[i].audio;
      if (window.LumaCreatorCore) LumaCreatorCore.remap(x, ids);
      else {
        x.asset = ids.get(x.asset) || null;
        x.audio = ids.get(x.audio) || null;
      }
    });
    const next = [...normalized, ...projects];
    if (JSON.stringify(next).length > 4000000)
      throw Error('Los datos de proyectos superan el espacio de almacenamiento local.');
    await new Promise((resolve, reject) => {
      const t = db.transaction('files', 'readwrite');
      for (const { old, ...a } of records) t.objectStore('files').put(a);
      t.oncomplete = resolve;
      t.onerror = () => reject(Error('No se pudo restaurar: almacenamiento lleno.'));
      t.onabort = () => reject(Error('La importación se canceló.'));
    });
    records.forEach(({ old, ...a }) => assets.push({ ...a, url: URL.createObjectURL(a.blob) }));
    projects = next;
    save();
    if (window.restoreCreatorBackup) restoreCreatorBackup(b, normalized, ids);
    if (typeof b.notes === 'string' && !localStorage.getItem('luma-notes'))
      localStorage.setItem('luma-notes', b.notes.slice(0, 200000));
    if (typeof b.code === 'string' && !localStorage.getItem('luma-code'))
      localStorage.setItem('luma-code', b.code.slice(0, 100000));
    toast(normalized.length + ' proyectos restaurados con sus archivos.');
    go('projects');
  });
}
function exportICS() {
  const x = p();
  if (!x.date) return toast('Selecciona una fecha en el proyecto.');
  const dt = new Date(x.date);
  if (!Number.isFinite(dt.getTime())) return toast('Fecha no válida.');
  const stamp = (d) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const clean = (s) =>
    String(s)
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Luma Studio//ES',
    'BEGIN:VEVENT',
    'UID:' + x.id + '@luma.local',
    'DTSTAMP:' + stamp(new Date()),
    'DTSTART:' + stamp(dt),
    'DTEND:' + stamp(new Date(dt.getTime() + 30 * 60000)),
    'SUMMARY:' + clean(x.name),
    'DESCRIPTION:' + clean(x.platform + '\n' + x.caption),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  download(new Blob([content], { type: 'text/calendar;charset=utf-8' }), x.name + '.ics');
}
let promptRAF = 0,
  promptRunning = false,
  promptLast = 0;
function renderTools() {
  cancelAnimationFrame(promptRAF);
  promptRunning = false;
  $('main').innerHTML =
    intro(
      'Menos fricción. Más contenido.',
      'Herramientas para preparar, grabar y proteger tu trabajo.',
    ) +
    '<div class="ideas"><section class="panel"><h3>Teleprompter</h3><label for="promptText">Guion para grabar</label><textarea id="promptText" style="height:180px" placeholder="Pega aquí tu guion…">' +
    esc(localStorage.getItem('luma-prompt') || localStorage.getItem('luma-script') || '') +
    '</textarea>' +
    field('promptSpeed', 'Velocidad de desplazamiento (px/s)', 35, 'range', 'min="10" max="120"') +
    field('promptSize', 'Tamaño de letra', 32, 'range', 'min="22" max="72"') +
    '<div class="actions"><button onclick="startPrompt()">▶ Iniciar / pausar</button><button onclick="resetPrompt()">↶ Al inicio</button><button onclick="document.querySelector(\'#promptView\').classList.toggle(\'mirror\')">↔ Espejo</button><button onclick="document.querySelector(\'#promptView\').requestFullscreen().catch(()=>toast(\'Pantalla completa no disponible\'))">⛶ Pantalla completa</button></div><div id="promptView" class="teleprompter" tabindex="0"><div id="promptContent"></div></div></section><section class="panel"><h3>Respaldo y continuidad</h3><p>Descarga tus proyectos con imágenes, videos y audio incluidos. Importa el respaldo en otro navegador para continuar.</p><div class="actions"><button class="primary" onclick="backupAll()">↓ Respaldo completo</button><button onclick="importBackup()">↥ Restaurar / importar</button></div><div class="notice">El navegador conserva tus archivos localmente. Guarda un respaldo antes de borrar sus datos. Los respaldos se agregan a tus proyectos actuales.</div><h3>Tiempo estimado del guion</h3><p id="wordCount"></p><h3>Flujo recomendado</h3><ol class="workflow"><li>Escribe tu guion y ensáyalo con el teleprompter.</li><li>Importa video, música e imágenes en Biblioteca.</li><li>Crea el proyecto, recorta y añade texto y subtítulos.</li><li>Revisa el checklist y exporta el archivo final.</li><li>Planifica la fecha y descarga el evento del calendario.</li></ol><h3>Atajos del editor</h3><p>Ctrl / ⌘ + S: guardar · Ctrl / ⌘ + Z: deshacer · Ctrl / ⌘ + Shift + Z: rehacer</p></section></div>';
  $('#promptText').oninput = updatePrompt;
  $('#promptSize').oninput = () =>
    ($('#promptContent').style.fontSize = $('#promptSize').value + 'px');
  updatePrompt();
}
function updatePrompt() {
  const t = $('#promptText').value;
  localStorage.setItem('luma-prompt', t);
  $('#promptContent').textContent = t;
  const n = t.trim() ? t.trim().split(/\s+/).length : 0;
  $('#wordCount').textContent =
    n +
    ' palabras · aproximadamente ' +
    Math.ceil((n / 140) * 60) +
    ' segundos a 140 palabras por minuto.';
}
function startPrompt() {
  if (!$('#promptText').value.trim()) return toast('Escribe un guion primero.');
  promptRunning = !promptRunning;
  if (!promptRunning) {
    cancelAnimationFrame(promptRAF);
    return;
  }
  promptLast = performance.now();
  function step(now) {
    if (!promptRunning || !$('#promptView')) return;
    $('#promptView').scrollTop += ((now - promptLast) / 1000) * +$('#promptSpeed').value;
    promptLast = now;
    if (
      $('#promptView').scrollTop + $('#promptView').clientHeight >=
      $('#promptView').scrollHeight - 1
    ) {
      promptRunning = false;
      return;
    }
    promptRAF = requestAnimationFrame(step);
  }
  promptRAF = requestAnimationFrame(step);
}
function resetPrompt() {
  promptRunning = false;
  cancelAnimationFrame(promptRAF);
  $('#promptView').scrollTop = 0;
}
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || rendering) return;
  if (e.key.toLowerCase() === 's') {
    e.preventDefault();
    save();
    toast('Cambios guardados en este navegador.');
  }
  if (
    view === 'editor' &&
    e.key.toLowerCase() === 'z' &&
    !['INPUT', 'TEXTAREA'].includes(e.target.tagName)
  ) {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  }
});
window.addEventListener('beforeunload', (e) => {
  if (rendering || labBusy) {
    e.preventDefault();
    e.returnValue = '';
  }
});

const labTemplates = {
  'Título animado': `ctx.fillStyle='#141326';ctx.fillRect(0,0,w,h);
const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#7357e8');gradient.addColorStop(1,'#e28abb');
ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(w*.8,h*.25,w*.55,0,Math.PI*2);ctx.fill();
const entrance=Math.min(1,t/1.2);
ctx.globalAlpha=entrance;ctx.fillStyle='white';ctx.textAlign='center';
ctx.font='800 '+w*.09+'px sans-serif';
ctx.fillText('TU PRÓXIMA',w/2,h*.48+(1-entrance)*80);
ctx.fillText('GRAN HISTORIA',w/2,h*.55+(1-entrance)*80);
ctx.font=w*.03+'px sans-serif';ctx.fillText('@tuusuario',w/2,h*.86);`,
  'Contador de lanzamiento': `ctx.fillStyle='#10111b';ctx.fillRect(0,0,w,h);
ctx.strokeStyle='#a38af9';ctx.lineWidth=w*.02;ctx.beginPath();ctx.arc(w/2,h/2,w*.32,-Math.PI/2,-Math.PI/2+Math.PI*2*(t%5)/5);ctx.stroke();
ctx.fillStyle='white';ctx.textAlign='center';ctx.font='800 '+w*.26+'px sans-serif';ctx.fillText(String(Math.max(1,5-Math.floor(t%5))),w/2,h*.55);
ctx.font='600 '+w*.035+'px sans-serif';ctx.fillText('ALGO GRANDE ESTÁ POR LLEGAR',w/2,h*.72);`,
  'Tip de carrusel': `ctx.fillStyle='#f2eddc';ctx.fillRect(0,0,w,h);
ctx.fillStyle='#536c56';ctx.fillRect(w*.08,h*.1,w*.14,w*.025);
ctx.textAlign='left';ctx.font='600 '+w*.035+'px sans-serif';ctx.fillText('CREA CON INTENCIÓN · 01',w*.08,h*.22);
ctx.font='800 '+w*.095+'px sans-serif';ctx.fillText('Una idea.',w*.08,h*.4);ctx.fillText('Una historia.',w*.08,h*.49);ctx.fillText('Tu voz.',w*.08,h*.58);
ctx.font=w*.032+'px sans-serif';ctx.fillText('Guarda este recordatorio para después.',w*.08,h*.83);`,
};
let labCode = localStorage.getItem('luma-code') || labTemplates['Título animado'],
  labBlob = null,
  labName = '',
  labURL = null;
function renderCode() {
  $('main').innerHTML =
    intro(
      'Tu creatividad también se escribe.',
      'Código JavaScript para crear títulos, fondos, contadores y clips animados.',
    ) +
    '<div class="lab-layout"><section class="panel"><h3>⌘ Código creativo</h3><label for="labTemplate">Punto de partida</label><select id="labTemplate">' +
    Object.keys(labTemplates)
      .map((t) => '<option>' + t + '</option>')
      .join('') +
    '</select><div class="actions"><button onclick="loadLabTemplate()">Cargar plantilla</button><button onclick="importLabCode()">↥ Importar .js</button><button onclick="download(new Blob([labCode],{type:\'text/javascript\'}),\'luma-creativo.js\')">↓ Código</button></div><p class="hint">Escribe instrucciones de Canvas 2D. Variables: <b>ctx</b> (dibujo), <b>w</b> (ancho), <b>h</b> (alto), <b>t</b> (segundos). El código se ejecuta en un worker aislado, sin acceso a los proyectos ni a la red.</p><textarea id="labCode" class="code-text lab-code" spellcheck="false" aria-label="Código JavaScript creativo">' +
    esc(labCode) +
    '</textarea><div class="actions"><select id="labFormat" aria-label="Formato del código"><option>9:16</option><option>1:1</option><option>16:9</option><option>4:5</option></select><button class="primary" onclick="runLab()">▶ Ejecutar código</button><button onclick="stopLab()">■ Detener</button></div><p id="labError" role="status" class="hint">Listo para ejecutar.</p></section><section class="panel"><h3>Vista previa</h3><iframe id="labFrame" sandbox="allow-scripts" title="Vista previa aislada del código" referrerpolicy="no-referrer"></iframe><div class="actions"><button onclick="labCommand(\'png\')">Capturar PNG</button><input id="labDuration" type="number" value="5" min="1" max="30" aria-label="Duración de animación en segundos" style="width:65px"><button onclick="labCommand(\'record\')">Grabar clip</button><button onclick="labCommand(\'cancel\')">Cancelar</button></div><p class="hint">El clip graba el lienzo durante 1–30 s, sin audio. Puedes usarlo como video de tu proyecto y añadir música en el editor.</p><div id="labOutput"></div></section></div>';
  $('#labCode').oninput = (e) => {
    labCode = e.target.value;
    localStorage.setItem('luma-code', labCode);
  };
  runLab();
}
function loadLabTemplate() {
  labCode = labTemplates[$('#labTemplate').value];
  $('#labCode').value = labCode;
  localStorage.setItem('luma-code', labCode);
  runLab();
}
function importLabCode() {
  chooseFile('.js,text/javascript', async (f) => {
    if (f.size > 100000) throw Error('Código demasiado grande (100 KB máximo).');
    labCode = await f.text();
    $('#labCode').value = labCode;
    localStorage.setItem('luma-code', labCode);
    toast('Código importado. Pulsa Ejecutar para probarlo.');
  });
}
function stopLab() {
  if (labBusy) labBusy = false;
  if ($('#labFrame')) $('#labFrame').srcdoc = '';
  if ($('#labError')) $('#labError').textContent = 'Ejecución detenida.';
}
function runLab() {
  if (labBusy) return toast('Cancela la grabación primero.');
  stopLab();
  labCode = $('#labCode').value;
  if (labCode.length > 100000) return toast('Máximo 100 KB de código.');
  localStorage.setItem('luma-code', labCode);
  const [w, h] = C.dimensions($('#labFormat').value, 720);
  const cfg = JSON.stringify({ code: labCode, w, h }).replace(/</g, '\\u003c');
  $('#labFrame').srcdoc =
    "<!doctype html><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; style-src 'unsafe-inline'; connect-src 'none'; img-src data: blob:; base-uri 'none'; form-action 'none'\"><style>html,body{margin:0;height:100%;background:#eeedf2;display:grid;place-items:center}canvas{max-width:100%;max-height:440px;width:auto;height:auto}</style><canvas width=\"" +
    w +
    '" height="' +
    h +
    '"></canvas><script>(' +
    labRuntime.toString() +
    ')(' +
    cfg +
    ');<\/script>';
  $('#labError').textContent = 'Iniciando vista previa…';
}
function labRuntime(cfg) {
  const canvas = document.querySelector('canvas'),
    ctx = canvas.getContext('2d');
  let worker,
    watchdog,
    recorder,
    chunks = [],
    stream,
    started = performance.now(),
    cancelled = false;
  const send = (kind, data = {}) => parent.postMessage({ lumaLab: kind, ...data }, '*');
  const workerMain = function () {
    let canvas, ctx, fn;
    onmessage = (e) => {
      try {
        if (e.data.kind === 'init') {
          canvas = new OffscreenCanvas(e.data.w, e.data.h);
          ctx = canvas.getContext('2d');
          fn = new Function('ctx', 'w', 'h', 't', e.data.code);
        } else if (e.data.kind === 'frame') {
          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          fn(ctx, canvas.width, canvas.height, e.data.t);
          ctx.restore();
          const bitmap = canvas.transferToImageBitmap();
          postMessage({ bitmap }, [bitmap]);
        }
      } catch (err) {
        postMessage({ error: err.message });
      }
    };
  };
  const workerURL = URL.createObjectURL(
    new Blob(['(' + workerMain.toString() + ')()'], { type: 'text/javascript' }),
  );
  worker = new Worker(workerURL);
  URL.revokeObjectURL(workerURL);
  function frame() {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      worker.terminate();
      send('error', {
        message: 'El código superó 2 segundos sin responder. Revisa bucles y vuelve a ejecutarlo.',
      });
      if (recorder?.state === 'recording') {
        cancelled = true;
        recorder.stop();
      }
    }, 2000);
    worker.postMessage({ kind: 'frame', t: (performance.now() - started) / 1000 });
  }
  worker.onerror = (e) => send('error', { message: e.message });
  worker.onmessage = (e) => {
    clearTimeout(watchdog);
    if (e.data.error) {
      worker.terminate();
      send('error', { message: e.data.error });
      if (recorder?.state === 'recording') {
        cancelled = true;
        recorder.stop();
      }
      return;
    }
    if (e.data.bitmap instanceof ImageBitmap) {
      ctx.drawImage(e.data.bitmap, 0, 0);
      e.data.bitmap.close();
      requestAnimationFrame(frame);
    }
  };
  worker.postMessage({ kind: 'init', ...cfg });
  frame();
  send('ready');
  addEventListener('message', async (e) => {
    if (e.source !== parent) return;
    const cmd = e.data?.lumaCommand;
    if (cmd === 'png') {
      canvas.toBlob((blob) => {
        if (blob) send('output', { blob, name: 'Luma-codigo.png' });
      });
      return;
    }
    if (cmd === 'cancel') {
      if (recorder?.state === 'recording') {
        cancelled = true;
        recorder.stop();
      }
      return;
    }
    if (cmd !== 'record' || recorder?.state === 'recording') return;
    try {
      const type = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      if (!type) throw Error('Este navegador no ofrece un formato compatible.');
      stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4500000 });
      chunks = [];
      cancelled = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => send('error', { message: 'El codificador falló.' });
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        send('done');
        if (!cancelled)
          send('output', {
            blob: new Blob(chunks, { type }),
            name: 'Luma-animacion.' + (type.includes('mp4') ? 'mp4' : 'webm'),
            duration: Math.min(30, Math.max(1, Number(e.data.duration) || 5)),
          });
      };
      started = performance.now();
      recorder.start(250);
      send('recording');
      const thisRecorder = recorder;
      setTimeout(
        () => {
          if (thisRecorder.state === 'recording') thisRecorder.stop();
        },
        Math.min(30, Math.max(1, Number(e.data.duration) || 5)) * 1000,
      );
    } catch (err) {
      send('error', { message: err.message });
    }
  });
}
function labCommand(kind) {
  const frame = $('#labFrame');
  if (!frame?.srcdoc) return toast('Ejecuta el código primero.');
  frame.contentWindow.postMessage({ lumaCommand: kind, duration: +$('#labDuration').value }, '*');
}
addEventListener('message', async (e) => {
  if (e.source !== $('#labFrame')?.contentWindow || typeof e.data?.lumaLab !== 'string') return;
  const { lumaLab: kind } = e.data;
  if (kind === 'error') {
    labBusy = false;
    $('#labError').textContent = 'Error: ' + String(e.data.message).slice(0, 500);
  }
  if (kind === 'ready') $('#labError').textContent = 'Vista previa activa · guardado localmente.';
  if (kind === 'recording') {
    labBusy = true;
    $('#labError').textContent = 'Grabando animación… mantén esta pestaña visible.';
  }
  if (kind === 'done') {
    labBusy = false;
    $('#labError').textContent = 'Grabación finalizada.';
  }
  if (kind === 'output') {
    let b = e.data.blob;
    if (
      !(b instanceof Blob) ||
      !b.size ||
      b.size > 180 * 1024 * 1024 ||
      !/^(image\/png|video\/(webm|mp4))/.test(b.type)
    )
      return;
    b = await C.webmDuration(b, +e.data.duration || 5);
    labBlob = b;
    labName = b.type.startsWith('image')
      ? 'Luma-codigo.png'
      : 'Luma-animacion.' + (b.type.includes('mp4') ? 'mp4' : 'webm');
    if (labURL) URL.revokeObjectURL(labURL);
    labURL = URL.createObjectURL(b);
    $('#labOutput').innerHTML =
      (b.type.startsWith('image')
        ? '<img alt="Resultado del código" src="' + labURL + '">'
        : '<video controls src="' + labURL + '"></video>') +
      '<div class="actions"><button onclick="download(labBlob,labName)">↓ Descargar resultado</button><button class="primary" onclick="saveLabAsset()">＋ Añadir a biblioteca</button></div>';
    $('#labError').textContent = 'Resultado listo para descargar o usar en un proyecto.';
  }
});
async function saveLabAsset() {
  try {
    if (!labBlob) return;
    const a = await storeAsset(labBlob, labName);
    if (p()) {
      p().asset = a.id;
      save();
    }
    toast('Recurso añadido a la biblioteca.');
    $('#labOutput').insertAdjacentHTML(
      'beforeend',
      '<button onclick="go(\'library\')">Abrir biblioteca →</button>',
    );
  } catch (e) {
    toast(e.message);
  }
}
go('home');

/* Keep source audio synchronized with the rendered fragment. */
const baseNewProject = newProject,
  baseImportFiles = importFiles;
newProject = function (...args) {
  if (rendering || labBusy) return toast('Finaliza la exportación primero.');
  baseNewProject(...args);
};
importFiles = function () {
  if (rendering || labBusy) return toast('Finaliza la exportación primero.');
  baseImportFiles();
};

async function saveFinalVideo() {
  try {
    if (!lastVideo) return;
    await storeAsset(lastVideo, lastVideoName);
    toast('Video terminado guardado en la biblioteca.');
  } catch (e) {
    toast(e.message);
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && rendering) {
    abortExport = true;
    toast('Exportación cancelada al ocultar la pestaña. Mantén el estudio visible al exportar.');
  }
  if (document.hidden && labBusy) labCommand('cancel');
});

let pendingAssetId = null;
useAsset = function (id) {
  const a = assets.find((a) => a.id === id);
  if (!a) return;
  if (!p()) {
    pendingAssetId = id;
    newProject();
    return;
  }
  if (a.type.startsWith('audio')) p().audio = id;
  else p().asset = id;
  save();
  go('editor');
};
const originalCreate = $('#create').onsubmit;
$('#create').onsubmit = function (e) {
  originalCreate(e);
  if (pendingAssetId && p()) {
    const a = assets.find((a) => a.id === pendingAssetId);
    if (a) {
      if (a.type.startsWith('audio')) p().audio = a.id;
      else p().asset = a.id;
      save();
      renderEditor();
    }
    pendingAssetId = null;
  }
};
