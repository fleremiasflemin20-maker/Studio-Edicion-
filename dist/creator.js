/* Fleremahias Creator Studio: media-first workspace, built independently for social content. */
const P = LumaCreatorCore;
let selectedLayer = 'base',
  toolTab = 'media',
  inspectorTab = 'design',
  easyMode = localStorage.getItem('luma-mode') !== 'pro',
  batchBusy = false,
  batchCancel = false,
  previewSequence = false,
  selectedQueue = new Set(),
  assetImages = new Map(),
  hitBoxes = [],
  canvasDrag = null;
const normalizeV2 = C.normalize;
C.normalize = function (v) {
  const x = normalizeV2(v),
    s = P.scene(v);
  for (const k of P.sceneKeys) if (k !== 'name') x[k] = s[k];
  x.scenes =
    Array.isArray(v.scenes) && v.scenes.length
      ? v.scenes.slice(0, 24).map(P.scene)
      : [P.scene({ ...v, name: 'Escena 1' })];
  const idx = Math.max(
    0,
    (v.scenes || []).findIndex((s) => s.id === v.activeScene),
  );
  x.activeScene = x.scenes[idx]?.id || x.scenes[0].id;
  x.musicLoop = v.musicLoop !== false;
  x.ducking = !!v.ducking;
  return x;
};
projects.forEach(P.ensure);
const saveV2 = save;
save = function () {
  if (p()) P.mirror(p());
  saveV2();
};
const editorV2 = renderEditor,
  renderV2 = render,
  goV2 = go;
go = function (v) {
  if (batchBusy && !batchInternal) return toast('Termina o cancela la preparación por lote.');
  if (p()) P.mirror(p());
  goV2(v);
};
let batchInternal = false;
views.push(['templates', '✦', 'Plantillas sociales'], ['publish', '↗', 'Publicación rápida']);
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
render = function () {
  document.body.classList.toggle('creator-active', view === 'editor');
  musicPreview?.pause();
  renderV2();
  if (view === 'templates') renderTemplates();
  if (view === 'publish') renderPublish();
  if (view === 'library')
    $('.actions').insertAdjacentHTML(
      'beforeend',
      '<button onclick="openMusicLibrary()">♫ Crear música</button>',
    );
  if (view === 'home')
    $('.hero').insertAdjacentHTML(
      'afterend',
      '<div class="creator-entry"><div><span>UN ESTUDIO, DE LA IDEA AL CLIP</span><h2>Arrastra. Combina. Cuenta tu historia.</h2><p>Escenas, capas, música y versiones para cada red.</p></div><button class="primary" onclick="go(\'templates\')">Explorar plantillas ↗</button></div>',
    );
};
function activeScene() {
  return p()?.scenes?.find((s) => s.id === p().activeScene);
}
function sync() {
  if (rendering) return;
  save();
  remember();
  renderTimeline();
  draw();
}
function selectScene(id) {
  if (rendering) return;
  P.activate(p(), id);
  selectedLayer = 'base';
  save();
  renderEditor();
}
function addScene(asset = null) {
  if (rendering) return;
  P.ensure(p());
  if (p().scenes.length >= 24) return toast('Máximo 24 escenas por proyecto.');
  P.mirror(p());
  const s = P.scene({
    name: 'Escena ' + (p().scenes.length + 1),
    asset,
    duration: 4,
    text: '',
    bg: brand().primary,
  });
  p().scenes.push(s);
  P.activate(p(), s.id);
  save();
  selectedLayer = 'base';
  renderEditor();
}
function moveScene(id, delta) {
  if (rendering) return;
  const list = p().scenes,
    i = list.findIndex((s) => s.id === id),
    to = Math.max(0, Math.min(list.length - 1, i + delta));
  if (i !== to) {
    P.mirror(p());
    list.splice(to, 0, list.splice(i, 1)[0]);
    save();
    renderTimeline();
  }
}
function duplicateScene() {
  P.mirror(p());
  if (p().scenes.length >= 24) return toast('Máximo 24 escenas.');
  const copy = P.scene(activeScene());
  copy.name += ' · copia';
  p().scenes.push(copy);
  P.activate(p(), copy.id);
  save();
  renderEditor();
}
function removeScene(id) {
  if (rendering) return;
  if (p().scenes.length === 1) return toast('El proyecto necesita al menos una escena.');
  P.mirror(p());
  p().scenes = p().scenes.filter((s) => s.id !== id);
  if (p().activeScene === id) P.activate(p(), p().scenes[0].id, false);
  save();
  renderEditor();
}
renderEditor = function () {
  if (!p()) {
    editorV2();
    return;
  }
  P.ensure(p());
  document.body.classList.add('creator-active');
  editorV2();
  const grid = $('.editor');
  if (!grid) return;
  grid.classList.add('creator-workspace');
  grid.classList.toggle('easy-mode', easyMode);
  const design = grid.children[0],
    stage = grid.children[1],
    publish = grid.children[2];
  design.classList.add('design-inspector');
  publish.classList.add('publish-inspector');
  const toolbox = document.createElement('section');
  toolbox.className = 'panel toolbox';
  toolbox.innerHTML =
    '<div class="tool-head"><strong>Tu caja creativa</strong><span>＋</span></div><input id="toolSearch" placeholder="Buscar en tu biblioteca…" aria-label="Buscar recursos"><div class="tool-tabs">' +
    [
      ['media', '▧', 'Medios'],
      ['text', 'T', 'Elementos'],
      ['filters', '◐', 'Filtros'],
      ['music', '♫', 'Música'],
      ['layers', '▱', 'Capas'],
    ]
      .map(
        ([id, icon, name]) =>
          '<button data-tool="' +
          id +
          '" onclick="setTool(\'' +
          id +
          '\')">' +
          icon +
          '<small>' +
          name +
          '</small></button>',
      )
      .join('') +
    '</div><div id="toolContent"></div><p class="hint">Arrastra al lienzo o a la secuencia. También puedes tocar cada recurso.</p>';
  const inspector = document.createElement('section');
  inspector.className = 'panel creator-inspector';
  inspector.innerHTML =
    '<div class="inspector-tabs"><button onclick="setInspector(\'design\')">Ajustes</button><button onclick="setInspector(\'publish\')">Publicar</button></div><div id="layerInspector"></div>';
  inspector.append(design, publish);
  grid.replaceChildren(toolbox, stage, inspector);
  stage.classList.add('creator-preview');
  stage.querySelector('.notice').textContent =
    'Haz clic en el texto o una capa y arrástrala para moverla. Exporta el montaje completo con texto, filtros, entradas y audio.';
  stage
    .querySelector('.actions')
    .insertAdjacentHTML(
      'beforeend',
      '<button onclick="playMontage()">▶ Ver montaje</button><button onclick="exportCarousel()">▥ Carrusel PNG</button>',
    );
  stage.insertAdjacentHTML(
    'beforeend',
    '<section class="timeline-panel"><div class="timeline-head"><strong>Tu secuencia</strong><span id="sequenceDuration"></span><button onclick="addScene()">＋ Escena</button></div><div id="sceneTrack" class="scene-track" aria-label="Orden de escenas"></div><div class="audio-track" data-dropzone="audio"><span>♫</span><span id="audioTrackName">Suelta aquí tu música</span></div></section>',
  );
  design.insertAdjacentHTML(
    'beforeend',
    '<div class="creator-extra">' +
      field(
        'textX',
        'Posición horizontal del título (%)',
        p().textX ?? 50,
        'range',
        'min="0" max="100"',
      ) +
      '<label for="sceneFit">Ajuste de imagen</label><select id="sceneFit"><option value="cover">Llenar y recortar</option><option value="contain">Ver imagen completa</option></select>' +
      field(
        'sceneZoom',
        'Zoom del encuadre',
        p().zoom ?? 1,
        'range',
        'min="1" max="3" step=".05"',
      ) +
      field('cropX', 'Encuadre horizontal', p().cropX ?? 50, 'range', 'min="0" max="100"') +
      field('cropY', 'Encuadre vertical', p().cropY ?? 50, 'range', 'min="0" max="100"') +
      '<label for="sceneTransition">Entrada entre escenas</label><select id="sceneTransition"><option value="cut">Corte directo</option><option value="fade">Fundido</option><option value="slide">Deslizar</option><option value="zoom">Acercar</option></select><label for="sceneFont">Tipografía del título</label><select id="sceneFont"><option value="sans-serif">Sans · editorial</option><option value="serif">Serif · clásico</option><option value="monospace">Mono · técnico</option></select><label for="subtitleStyle">Estilo de subtítulos</label><select id="subtitleStyle"><option value="dark">Caja oscura</option><option value="plain">Blanco con sombra</option><option value="yellow">Amarillo</option><option value="karaoke">Palabra resaltada</option><option value="outline">Contorno</option><option value="pill">Píldora</option><option value="mint">Menta</option><option value="magenta">Magenta</option></select><div class="actions"><button onclick="duplicateScene()">Duplicar escena</button><button onclick="removeScene(p().activeScene)">Quitar escena</button></div></div>',
  );
  const bindings = {
    textX: 'textX',
    sceneFit: 'fit',
    sceneZoom: 'zoom',
    cropX: 'cropX',
    cropY: 'cropY',
    sceneTransition: 'transition',
    sceneFont: 'font',
    subtitleStyle: 'subtitleStyle',
  };
  for (const [id, key] of Object.entries(bindings)) {
    const el = $('#' + id);
    el.value = p()[key];
    el.oninput = (e) => {
      p()[key] = ['textX', 'zoom', 'cropX', 'cropY'].includes(key)
        ? +e.target.value
        : e.target.value;
      sync();
    };
  }
  publish.insertAdjacentHTML(
    'beforeend',
    '<label class="check"><input id="musicLoop" type="checkbox" ' +
      (p().musicLoop ? 'checked' : '') +
      '> Repetir la pista musical</label><label class="check"><input id="ducking" type="checkbox" ' +
      (p().ducking ? 'checked' : '') +
      '> Bajar música cuando suena el audio original</label><button class="primary" onclick="queueCurrent()">↗ Preparar para redes</button>',
  );
  for (const key of ['musicLoop', 'ducking'])
    $('#' + key).onchange = (e) => {
      p()[key] = e.target.checked;
      sync();
    };
  $('.actions').insertAdjacentHTML(
    'beforeend',
    '<button id="modeButton" onclick="toggleEasy()">' +
      (easyMode ? '◉ Modo Fácil' : '⚡ Modo Pro') +
      '</button><button onclick="go(\'templates\')">✦ Plantillas</button>',
  );
  const bottom = $('.editor-bottom');
  if (bottom) {
    bottom.classList.add('creator-bottom');
    bottom
      .querySelector('.panel')
      .insertAdjacentHTML('afterbegin', '<p class="eyebrow">ESCENA SELECCIONADA</p>');
  }
  $('#toolSearch').oninput = renderTool;
  setInspector(inspectorTab);
  renderTool();
  renderTimeline();
  for (const id of ['start', 'end', 'duration'])
    $('#' + id)?.addEventListener('input', renderTimeline);
  bindCanvas();
  loadLayerImages(p().layers || []);
  draw();
  if (previewMedia) {
    previewMedia.addEventListener(
      'loadedmetadata',
      () => {
        if (p() && previewMedia && Number.isFinite(previewMedia.duration)) {
          p().sourceDuration = previewMedia.duration;
          save();
          renderTimeline();
        }
      },
      { once: true },
    );
    if (Number.isFinite(previewMedia.duration)) {
      p().sourceDuration = previewMedia.duration;
      save();
    }
  }
};
function toggleEasy() {
  easyMode = !easyMode;
  localStorage.setItem('luma-mode', easyMode ? 'easy' : 'pro');
  $('.creator-workspace').classList.toggle('easy-mode', easyMode);
  $('#modeButton').textContent = easyMode ? '◉ Modo Fácil' : '⚡ Modo Pro';
}
function setInspector(tab) {
  inspectorTab = tab;
  $('.design-inspector').hidden = tab !== 'design';
  $('.publish-inspector').hidden = tab !== 'publish';
  $('#layerInspector').hidden = tab !== 'design' || selectedLayer === 'base';
  document
    .querySelectorAll('.inspector-tabs button')
    .forEach((b, i) => b.classList.toggle('active', i === (tab === 'design' ? 0 : 1)));
  if (tab === 'design') renderLayerInspector();
}
function setTool(tab) {
  toolTab = tab;
  renderTool();
}
function renderTool() {
  if (!$('#toolContent')) return;
  document
    .querySelectorAll('[data-tool]')
    .forEach((b) => b.classList.toggle('active', b.dataset.tool === toolTab));
  const q = $('#toolSearch').value.toLowerCase();
  let html = '';
  if (toolTab === 'media') {
    html =
      '<button class="upload-tile" onclick="importFiles()">↥ Importar archivos<br><small>o suéltalos desde tu equipo</small></button><div class="media-tiles">' +
      assets
        .filter((a) => !a.type.startsWith('audio') && a.name.toLowerCase().includes(q))
        .map(
          (a) =>
            '<button draggable="true" data-kind="asset" data-id="' +
            a.id +
            '" onclick="putAsset(\'' +
            a.id +
            '\')">' +
            (a.type.startsWith('image')
              ? '<img alt="" src="' + a.url + '">'
              : '<video muted preload="metadata" src="' +
                a.url +
                '"></video><span class="video-icon">▶</span>') +
            '<small>' +
            esc(a.name) +
            '</small></button>',
        )
        .join('') +
      '</div>';
  }
  if (toolTab === 'text')
    html =
      '<h4>Texto y piezas</h4><button onclick="uploadImageLayer()">＋ Imagen como capa</button><div class="element-tiles">' +
      [
        ['text', 'T', 'Texto libre'],
        ['tag', 'Aa', 'Etiqueta'],
        ['cta', '↗', 'Llamada a la acción'],
        ['shape', '▰', 'Fondo de color'],
        ['sticker', '✦', 'Sticker'],
      ]
        .map(
          ([id, icon, name]) =>
            '<button draggable="true" data-kind="element" data-id="' +
            id +
            '" onclick="addElement(\'' +
            id +
            '\')"><span>' +
            icon +
            '</span><small>' +
            name +
            '</small></button>',
        )
        .join('') +
      '</div><h4>Stickers</h4><div class="sticker-grid">' +
      ['✨', '🔥', '❤️', '⭐', '💬', '🎬', '🎧', '🚀', '💡', '📌', '✅', '👉']
        .map(
          (s) =>
            '<button draggable="true" data-kind="sticker" data-id="' +
            s +
            "\" onclick=\"addElement('sticker','" +
            s +
            '\')">' +
            s +
            '</button>',
        )
        .join('') +
      '</div><h4>Tu marca</h4><button onclick="applyBrand()">Aplicar colores de marca</button><button onclick="brandDialog()">Editar kit de marca</button>';
  if (toolTab === 'filters')
    html =
      '<p class="hint">Se aplican a la escena y al archivo exportado.</p><div class="filter-tiles">' +
      P.filters
        .map(
          (f) =>
            '<button class="' +
            (p().filter === f.id ? 'selected' : '') +
            '" style="--swatch:' +
            f.swatch +
            '" onclick="setFilter(\'' +
            f.id +
            '\')"><span></span><small>' +
            f.name +
            '</small></button>',
        )
        .join('') +
      '</div>';
  if (toolTab === 'music')
    html =
      '<p class="hint">Pistas sintetizadas en Fleremahias. Pulsa ▶ para escuchar y ＋ para usarlas. Puedes importar tu propia música.</p>' +
      P.music
        .filter((m) => m.name.toLowerCase().includes(q))
        .map(
          (m) =>
            '<div class="music-item"><button aria-label="Escuchar ' +
            m.name +
            '" onclick="previewTrack(\'' +
            m.id +
            '\')">▶</button><div><strong>' +
            m.name +
            '</strong><small>' +
            m.bpm +
            ' BPM · bucle de 16 s</small></div><button aria-label="Añadir ' +
            m.name +
            '" onclick="addMusic(\'' +
            m.id +
            '\')">＋</button></div>',
        )
        .join('') +
      '<button onclick="importFiles()">↥ Importar música o voz</button>';
  if (toolTab === 'layers')
    html =
      '<h4>Capas de la escena</h4><button class="layer-row ' +
      (selectedLayer === 'base' ? 'selected' : '') +
      '" onclick="selectLayer(\'base\')">T &nbsp; Título principal</button>' +
      (p().layers || [])
        .map(
          (l, i) =>
            '<div class="layer-row ' +
            (selectedLayer === l.id ? 'selected' : '') +
            '" draggable="true" data-kind="layer" data-id="' +
            l.id +
            '"><button onclick="selectLayer(\'' +
            l.id +
            '\')">' +
            (l.kind === 'shape' ? '▰' : l.kind === 'image' ? '▧' : 'T') +
            ' &nbsp; ' +
            esc(l.kind === 'shape' ? 'Forma ' + (i + 1) : l.text.slice(0, 25)) +
            '</button><button aria-label="Mostrar u ocultar capa" onclick="toggleLayer(\'' +
            l.id +
            '\')">' +
            (l.hidden ? '○' : '●') +
            '</button></div>',
        )
        .reverse()
        .join('') +
      '<p class="hint">Arrastra las capas para cambiar su orden. Las de arriba aparecen delante.</p>';
  $('#toolContent').innerHTML = html;
  bindPalette();
}
function renderTimeline() {
  if (!$('#sceneTrack') || !p()) return;
  const x = p();
  P.mirror(x);
  $('#sceneTrack').innerHTML =
    x.scenes
      .map(
        (s, i) =>
          '<div class="scene-card ' +
          (s.id === x.activeScene ? 'active' : '') +
          '" draggable="true" data-kind="scene" data-id="' +
          s.id +
          '" role="group" aria-label="Escena ' +
          esc(s.name) +
          '"><button class="scene-select" onclick="selectScene(\'' +
          s.id +
          '\')"><span class="scene-thumb" style="background:' +
          s.bg +
          '">' +
          (assets.find((a) => a.id === s.asset)?.type.startsWith('image')
            ? '<img src="' + assets.find((a) => a.id === s.asset).url + '" alt="">'
            : '<span>' + esc(s.text?.slice(0, 22) || '▧') + '</span>') +
          '</span><strong>' +
          esc(s.name) +
          '</strong><small>' +
          (P.length(s) > 0 ? P.length(s).toFixed(1) + ' s' : 'Revisar') +
          ' · ' +
          (s.transition === 'cut'
            ? 'Corte'
            : s.transition === 'fade'
              ? 'Fundido'
              : s.transition === 'zoom'
                ? 'Acercar'
                : 'Deslizar') +
          '</small></button><div class="scene-order"><button aria-label="Mover escena ' +
          (i + 1) +
          ' a la izquierda" onclick="moveScene(\'' +
          s.id +
          '\',-1)">←</button><button aria-label="Mover escena ' +
          (i + 1) +
          ' a la derecha" onclick="moveScene(\'' +
          s.id +
          '\',1)">→</button></div></div>',
      )
      .join('') +
    '<button class="scene-add" data-dropzone="newscene" onclick="addScene()">＋<small>Suelta un clip<br>o añade una escena</small></button>';
  const total = x.scenes.reduce((n, s) => n + Math.max(0, P.length(s)), 0);
  $('#sequenceDuration').textContent = x.scenes.length + ' escenas · ' + total.toFixed(1) + ' s';
  $('#audioTrackName').textContent =
    assets.find((a) => a.id === x.audio)?.name || 'Suelta aquí tu música';
  bindPalette();
}
function setFilter(id) {
  p().filter = id;
  sync();
  renderTool();
}
function putAsset(id, asNew = false) {
  if (rendering) return;
  const a = assets.find((a) => a.id === id);
  if (!a) return;
  if (a.type.startsWith('audio')) {
    p().audio = id;
    save();
    renderEditor();
  } else if (asNew) addScene(id);
  else {
    p().asset = id;
    p().start = 0;
    p().end = 0;
    p().sourceDuration = 0;
    save();
    renderEditor();
  }
}
function addElement(kind, value = '', pos = null) {
  if (rendering) return;
  if ((p().layers || []).length >= 40) return toast('Máximo 40 capas por escena.');
  const l = P.layer({
    kind: kind === 'shape' ? 'shape' : kind === 'sticker' ? 'sticker' : 'text',
    text:
      value ||
      (kind === 'cta'
        ? 'Guárdalo para después ↗'
        : kind === 'tag'
          ? 'NUEVO'
          : kind === 'sticker'
            ? '✨'
            : 'Tu texto aquí'),
    fill: brand().primary,
    size: kind === 'sticker' ? 130 : kind === 'tag' ? 42 : 64,
    y: kind === 'cta' ? 84 : kind === 'tag' ? 20 : 50,
    ...pos,
  });
  if (kind === 'tag') {
    l.fill = brand().primary;
    l.kind = 'text';
  }
  p().layers.push(l);
  selectedLayer = l.id;
  sync();
  renderTool();
  renderLayerInspector();
}
function selectLayer(id) {
  selectedLayer = id;
  setInspector('design');
  renderTool();
  draw();
}
function toggleLayer(id) {
  const l = p().layers.find((l) => l.id === id);
  if (l) {
    l.hidden = !l.hidden;
    sync();
    renderTool();
  }
}
function renderLayerInspector() {
  const box = $('#layerInspector');
  if (!box) return;
  const l = p().layers.find((l) => l.id === selectedLayer);
  box.hidden = !l || inspectorTab !== 'design';
  $('.design-inspector').hidden = inspectorTab !== 'design' || !!l;
  if (!l) return;
  box.innerHTML =
    '<h3>' +
    { shape: 'Forma', sticker: 'Sticker', image: 'Imagen', text: 'Texto', counter: 'Temporizador' }[
      l.kind
    ] +
    ' seleccionado</h3>' +
    (l.kind === 'text' || l.kind === 'sticker' || l.kind === 'counter'
      ? '<label for="layerText">Contenido</label><textarea id="layerText">' +
        esc(l.text) +
        '</textarea>'
      : '') +
    field('layerX', 'Posición X (%)', l.x, 'range', 'min="0" max="100"') +
    field('layerY', 'Posición Y (%)', l.y, 'range', 'min="0" max="100"') +
    field('layerSize', 'Tamaño', l.size, 'range', 'min="16" max="220"') +
    field('layerWidth', 'Ancho (%)', l.width, 'range', 'min="5" max="100"') +
    (l.kind === 'shape' || l.kind === 'image'
      ? field('layerHeight', 'Alto (%)', l.height, 'range', 'min="2" max="100"')
      : '') +
    field('layerColor', 'Color', l.kind === 'shape' ? l.fill : l.color, 'color') +
    field('layerOpacity', 'Opacidad', l.opacity, 'range', 'min="0" max="1" step=".05"') +
    field('layerRotation', 'Rotación', l.rotation, 'range', 'min="-180" max="180"') +
    '<label for="layerAnimation">Animación de entrada</label><select id="layerAnimation"><option value="none">Sin animación</option><option value="fade">Aparecer</option><option value="slide">Subir</option><option value="pop">Pop</option><option value="float">Flotar</option><option value="bounce">Rebotar</option><option value="rotate">Girar</option><option value="pulse">Pulso</option><option value="typewriter">Escribir</option></select><label class="check"><input id="layerLocked" type="checkbox" ' +
    (l.locked ? 'checked' : '') +
    '> Bloquear movimiento</label><div class="actions"><button onclick="copyLayer()">Duplicar</button><button onclick="deleteLayer()">Eliminar capa</button></div><button onclick="selectLayer(\'base\')">← Ajustes de la escena</button>';
  $('#layerAnimation').value = l.animation;
  const map = {
    layerText: 'text',
    layerX: 'x',
    layerY: 'y',
    layerSize: 'size',
    layerWidth: 'width',
    layerHeight: 'height',
    layerColor: l.kind === 'shape' ? 'fill' : 'color',
    layerOpacity: 'opacity',
    layerRotation: 'rotation',
    layerAnimation: 'animation',
  };
  for (const [id, k] of Object.entries(map))
    if ($('#' + id))
      $('#' + id).oninput = (e) => {
        l[k] = ['text', 'color', 'fill', 'animation'].includes(k)
          ? e.target.value
          : +e.target.value;
        sync();
      };
  $('#layerLocked').onchange = (e) => {
    l.locked = e.target.checked;
    sync();
  };
}
function copyLayer() {
  const l = p().layers.find((l) => l.id === selectedLayer);
  if (!l) return;
  const copy = P.layer({ ...l, x: Math.min(95, l.x + 3), y: Math.min(95, l.y + 3) });
  p().layers.push(copy);
  selectedLayer = copy.id;
  sync();
  renderTool();
  renderLayerInspector();
}
function deleteLayer() {
  p().layers = p().layers.filter((l) => l.id !== selectedLayer);
  selectedLayer = 'base';
  sync();
  renderTool();
  renderLayerInspector();
}
function bindPalette() {
  document.querySelectorAll('[draggable="true"][data-kind]').forEach((el) => {
    el.ondragstart = (e) => {
      if (rendering) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData(
        'application/x-luma',
        JSON.stringify({ kind: el.dataset.kind, id: el.dataset.id }),
      );
      el.classList.add('dragging');
    };
    el.ondragend = () => el.classList.remove('dragging');
  });
}
function bindCanvas() {
  const c = $('#canvas');
  if (!c) return;
  c.style.touchAction = 'none';
  c.tabIndex = 0;
  c.onpointerdown = (e) => {
    if (rendering) return;
    c.focus({ preventScroll: true });
    const r = c.getBoundingClientRect(),
      point = {
        x: ((e.clientX - r.left) / r.width) * c.width,
        y: ((e.clientY - r.top) / r.height) * c.height,
      };
    const b = [...hitBoxes]
      .reverse()
      .find(
        (b) => point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h,
      );
    if (!b) return;
    selectLayer(b.id);
    const layer = b.id === 'base' ? null : p().layers.find((l) => l.id === b.id);
    if (layer?.locked) return;
    canvasDrag = {
      id: b.id,
      clientX: e.clientX,
      clientY: e.clientY,
      x: layer?.x ?? p().textX ?? 50,
      y: layer?.y ?? p().textY ?? 50,
    };
    c.setPointerCapture(e.pointerId);
  };
  c.onpointermove = (e) => {
    if (!canvasDrag || rendering) return;
    const r = c.getBoundingClientRect(),
      snap = (v) => [10, 50, 90].find((n) => Math.abs(n - v) < 1.4) ?? v;
    const x = Math.max(
        0,
        Math.min(100, snap(canvasDrag.x + ((e.clientX - canvasDrag.clientX) / r.width) * 100)),
      ),
      y = Math.max(
        0,
        Math.min(100, snap(canvasDrag.y + ((e.clientY - canvasDrag.clientY) / r.height) * 100)),
      );
    if (canvasDrag.id === 'base') {
      p().textX = x;
      p().textY = y;
    } else {
      const l = p().layers.find((l) => l.id === canvasDrag.id);
      l.x = x;
      l.y = y;
    }
    draw();
  };
  const end = () => {
    if (canvasDrag) {
      canvasDrag = null;
      sync();
      if (selectedLayer === 'base') {
        if ($('#textY')) $('#textY').value = p().textY;
        if ($('#textX')) $('#textX').value = p().textX;
      }
      renderLayerInspector();
    }
  };
  c.onpointerup = end;
  c.onpointercancel = end;
}
document.addEventListener('dragover', (e) => {
  if (e.target.closest('.creator-workspace,.scene-card,.layer-row')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
});
document.addEventListener('drop', async (e) => {
  const target = e.target.closest('.creator-workspace');
  if (!target) return;
  e.preventDefault();
  if (rendering) return;
  try {
    const isNew = !!e.target.closest('#sceneTrack'),
      audio = !!e.target.closest('.audio-track');
    if (e.dataTransfer.files.length) {
      for (const f of e.dataTransfer.files) {
        if (!/^(image|video|audio)\//.test(f.type)) continue;
        if (f.size > 250 * 1024 * 1024) throw Error('Máximo 250 MB por archivo.');
        const a = await storeAsset(f, f.name);
        if (a.type.startsWith('audio')) p().audio = a.id;
        else if (isNew) addScene(a.id);
        else {
          p().asset = a.id;
          p().start = 0;
          p().end = 0;
          p().sourceDuration = 0;
        }
      }
      save();
      renderEditor();
      return;
    }
    const raw = e.dataTransfer.getData('application/x-luma');
    if (!raw) return;
    const item = JSON.parse(raw),
      card = e.target.closest('.scene-card');
    if (item.kind === 'scene' && card) {
      P.mirror(p());
      const from = p().scenes.findIndex((s) => s.id === item.id),
        to = p().scenes.findIndex((s) => s.id === card.dataset.id);
      if (from >= 0 && to >= 0) {
        p().scenes.splice(to, 0, p().scenes.splice(from, 1)[0]);
        save();
        renderTimeline();
      }
      return;
    }
    if (item.kind === 'layer' && e.target.closest('.layer-row')) {
      const list = p().layers,
        from = list.findIndex((l) => l.id === item.id),
        to = list.findIndex((l) => l.id === e.target.closest('.layer-row').dataset.id);
      if (from >= 0 && to >= 0) {
        list.splice(to, 0, list.splice(from, 1)[0]);
        sync();
        renderTool();
      }
      return;
    }
    if (item.kind === 'asset') {
      putAsset(item.id, isNew && !audio);
      return;
    }
    if (item.kind === 'element' || item.kind === 'sticker') {
      const r = $('#canvas').getBoundingClientRect(),
        pos = {
          x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
          y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
        };
      addElement(
        item.kind === 'sticker' ? 'sticker' : item.id,
        item.kind === 'sticker' ? item.id : '',
        pos,
      );
    }
  } catch (err) {
    toast(err.message);
  }
});
function brand() {
  try {
    return {
      name: 'Mi marca',
      primary: '#7658df',
      secondary: '#f0c6a8',
      cta: 'Guárdalo y compártelo',
      hashtags: '#creadores #contenido',
      ...JSON.parse(localStorage.getItem('luma-brand') || '{}'),
    };
  } catch {
    return {
      name: 'Mi marca',
      primary: '#7658df',
      secondary: '#f0c6a8',
      cta: 'Guárdalo',
      hashtags: '#contenido',
    };
  }
}
function brandDialog() {
  const d = document.createElement('dialog');
  d.className = 'brand-dialog';
  const b = brand();
  d.innerHTML =
    '<form method="dialog"><h2>Tu kit de marca</h2>' +
    field('brandName', 'Nombre de tu marca', b.name) +
    field('brandPrimary', 'Color principal', b.primary, 'color') +
    field('brandSecondary', 'Color secundario', b.secondary, 'color') +
    field('brandCTA', 'Llamada a la acción', b.cta) +
    field('brandTags', 'Hashtags habituales', b.hashtags) +
    '<button class="primary" id="saveBrand">Guardar kit</button><button>Cancelar</button></form>';
  document.body.append(d);
  $('#saveBrand').onclick = () => {
    localStorage.setItem(
      'luma-brand',
      JSON.stringify({
        name: $('#brandName').value.slice(0, 100),
        primary: $('#brandPrimary').value,
        secondary: $('#brandSecondary').value,
        cta: $('#brandCTA').value.slice(0, 500),
        hashtags: $('#brandTags').value.slice(0, 1000),
      }),
    );
    toast('Kit de marca guardado');
  };
  d.onclose = () => d.remove();
  d.showModal();
}
function applyBrand() {
  const b = brand();
  p().bg = b.primary;
  p().color = '#ffffff';
  sync();
  toast('Colores aplicados a esta escena.');
}
let musicPreview = null,
  musicURLs = new Map();
async function previewTrack(id) {
  musicPreview?.pause();
  if (!musicURLs.has(id)) musicURLs.set(id, URL.createObjectURL(P.wav(id, 16)));
  musicPreview = new Audio(musicURLs.get(id));
  musicPreview.volume = 0.65;
  await musicPreview.play().catch((e) => toast(e.message));
}
async function addMusic(id) {
  try {
    const m = P.music.find((m) => m.id === id);
    toast('Creando pista…');
    const existing = assets.find((a) => a.name === 'Fleremahias · ' + m.name + '.wav');
    const a = existing || (await storeAsset(P.wav(id, 16), 'Fleremahias · ' + m.name + '.wav'));
    musicPreview?.pause();
    if (p()) {
      p().audio = a.id;
      p().musicLoop = true;
      save();
      renderEditor();
    } else render();
    toast('Pista añadida a la biblioteca.');
  } catch (e) {
    toast(e.message);
  }
}
function openMusicLibrary() {
  if (p()) {
    go('editor');
    setTool('music');
  } else {
    newProject();
    toast('Crea un proyecto para añadir música.');
  }
}
function loadLayerImages(layers) {
  for (const l of layers) {
    if (l.kind !== 'image' || !l.asset || assetImages.has(l.asset)) continue;
    const a = assets.find((a) => a.id === l.asset);
    if (!a) continue;
    const i = new Image();
    i.onload = () => {
      assetImages.set(l.asset, i);
      draw();
    };
    i.src = a.url;
  }
}

async function uploadImageLayer() {
  chooseFile('image/*', async (file) => {
    if (file.size > 30 * 1024 * 1024) throw Error('La imagen supera 30 MB.');
    const asset = await storeAsset(file, file.name);
    const l = P.layer({ kind: 'image', asset: asset.id, width: 35, height: 25, x: 50, y: 30 });
    p().layers.push(l);
    selectedLayer = l.id;
    save();
    loadLayerImages(p().layers);
    renderTool();
    renderLayerInspector();
    draw();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.target !== $('#canvas') || rendering) return;
  const l = selectedLayer === 'base' ? null : p().layers.find((l) => l.id === selectedLayer);
  if (l?.locked) return;
  const delta = e.shiftKey ? 5 : 1;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0,
      dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0;
    if (l) {
      l.x = P.n(l.x + dx, 0, 100, 50);
      l.y = P.n(l.y + dy, 0, 100, 50);
    } else {
      p().textX = P.n(p().textX + dx, 0, 100, 50);
      p().textY = P.n(p().textY + dy, 0, 100, 50);
    }
    sync();
    renderLayerInspector();
  }
  if (e.key === 'Delete' && l) {
    e.preventDefault();
    deleteLayer();
  }
});

/* Pointer-based palette dragging also supports touch; OS file drops retain native DataTransfer. */
let palettePointer = null,
  ignorePaletteClickUntil = 0;
bindPalette = function () {
  document.querySelectorAll('[data-kind]').forEach((el) => {
    el.draggable = false;
    el.ondragstart = (e) => e.preventDefault();
  });
};
function applyCreatorDrop(item, node, x, y) {
  if (rendering || !node?.closest('.creator-workspace')) return;
  const card = node.closest('.scene-card');
  if (item.kind === 'scene') {
    const list = p().scenes,
      from = list.findIndex((s) => s.id === item.id),
      to = card
        ? list.findIndex((s) => s.id === card.dataset.id)
        : node.closest('.scene-add')
          ? list.length - 1
          : -1;
    if (from >= 0 && to >= 0 && from !== to) {
      P.mirror(p());
      list.splice(to, 0, list.splice(from, 1)[0]);
      save();
      remember();
      renderTimeline();
      toast('Escena movida');
    }
    return;
  }
  if (item.kind === 'layer') {
    const row = node.closest('.layer-row');
    if (!row) return;
    const list = p().layers,
      from = list.findIndex((l) => l.id === item.id),
      to = list.findIndex((l) => l.id === row.dataset.id);
    if (from >= 0 && to >= 0 && from !== to) {
      list.splice(to, 0, list.splice(from, 1)[0]);
      sync();
      renderTool();
      toast('Orden de capas actualizado');
    }
    return;
  }
  if (item.kind === 'asset') {
    if (!node.closest('.v2stage,#sceneTrack,.audio-track')) return;
    putAsset(item.id, !!node.closest('#sceneTrack'));
    return;
  }
  if (!node.closest('.v2stage')) return;
  const r = $('#canvas').getBoundingClientRect(),
    pos = {
      x: P.n(((x - r.left) / r.width) * 100, 0, 100, 50),
      y: P.n(((y - r.top) / r.height) * 100, 0, 100, 50),
    };
  addElement(
    item.kind === 'sticker' ? 'sticker' : item.id,
    item.kind === 'sticker' ? item.id : '',
    pos,
  );
  toast('Pieza añadida al lienzo');
}
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-kind]');
  if (!el || rendering || e.button > 0 || e.target.closest('.scene-order')) return;
  palettePointer = {
    el,
    item: { kind: el.dataset.kind, id: el.dataset.id },
    x: e.clientX,
    y: e.clientY,
    at: performance.now(),
    touch: e.pointerType === 'touch',
    dragging: false,
    ghost: null,
    pointerId: e.pointerId,
  };
  if (e.pointerType !== 'touch') e.preventDefault();
});
document.addEventListener(
  'pointermove',
  (e) => {
    const d = palettePointer;
    if (!d) return;
    const distance = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (!d.dragging) {
      if (d.touch && performance.now() - d.at < 220) {
        if (distance > 8) palettePointer = null;
        return;
      }
      if (distance < 6) return;
      d.dragging = true;
      d.el.setPointerCapture?.(e.pointerId);
      d.el.classList.add('dragging');
      d.ghost = document.createElement('div');
      d.ghost.className = 'palette-ghost';
      d.ghost.textContent =
        d.item.kind === 'scene'
          ? 'Mover escena'
          : d.item.kind === 'asset'
            ? 'Añadir medio'
            : d.item.kind === 'layer'
              ? 'Mover capa'
              : 'Añadir pieza';
      document.body.append(d.ghost);
    }
    e.preventDefault();
    d.ghost.style.left = e.clientX + 12 + 'px';
    d.ghost.style.top = e.clientY + 12 + 'px';
    document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest('.scene-card,.scene-add,.v2stage,.audio-track,.layer-row');
    target?.classList.add('drop-target');
  },
  { passive: false },
);
function finishPalette(e, cancel = false) {
  const d = palettePointer;
  palettePointer = null;
  if (!d) return;
  d.el.classList.remove('dragging');
  d.ghost?.remove();
  document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
  if (d.dragging) {
    ignorePaletteClickUntil = Date.now() + 350;
    e.preventDefault();
    if (!cancel)
      applyCreatorDrop(
        d.item,
        document.elementFromPoint(e.clientX, e.clientY),
        e.clientX,
        e.clientY,
      );
  }
}
document.addEventListener('pointerup', (e) => finishPalette(e));
document.addEventListener('pointercancel', (e) => finishPalette(e, true));
document.addEventListener(
  'click',
  (e) => {
    if (Date.now() < ignorePaletteClickUntil && e.target.closest('.creator-workspace')) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);
