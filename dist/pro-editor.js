/**
 * One-click tools controller. Actions are dispatched through data attributes,
 * keeping presets, rendering and application integration separate.
 */
(function (root) {
  const Core = root.LumaProCore;
  const selectedMedia = new Set(),
    waveforms = new Map();
  let activeTab = 'text',
    search = '',
    dialog = null,
    previewImage = null;
  const favoritesKey = 'luma-favorites-v1';
  const tabs = [
    ['text', 'Texto'],
    ['blocks', 'Bloques listos'],
    ['quick', 'Acciones rápidas'],
    ['reel', 'Reel por BPM'],
    ['adjust', 'Imagen'],
    ['captions', 'Subtítulos'],
    ['mine', 'Mis elementos'],
    ['review', 'Revisión'],
  ];
  function currentLayer() {
    return selectedLayer === 'base' ? null : p()?.layers.find((l) => l.id === selectedLayer);
  }
  function notify(message) {
    toast(message);
  }
  function requireProject() {
    if (!p()) throw Error('Abre o crea un proyecto primero.');
    if (rendering || batchBusy) throw Error('Termina el proceso en curso antes de editar.');
    return p();
  }
  function commit(rebuild = false) {
    save();
    remember();
    if (rebuild) {
      renderEditor();
    } else {
      renderTimeline();
      renderTool();
      renderLayerInspector();
      draw();
    }
    preview();
  }
  function close() {
    dialog?.close();
    dialog?.remove();
    dialog = null;
  }
  function button(label, action, value = '', className = '') {
    return (
      '<button type="button" class="' +
      className +
      '" data-luma-action="' +
      action +
      '" data-value="' +
      esc(value) +
      '">' +
      label +
      '</button>'
    );
  }
  function favoriteItems() {
    try {
      const data = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
      return Array.isArray(data) ? data.slice(0, 30) : [];
    } catch {
      return [];
    }
  }
  function saveFavorites(items) {
    localStorage.setItem(favoritesKey, JSON.stringify(items.slice(0, 30)));
  }
  function open(tab = 'text') {
    if (!p()) {
      notify('Crea o abre un proyecto para usar las herramientas.');
      go('projects');
      return;
    }
    if (rendering || batchBusy) return notify('Termina el proceso en curso.');
    close();
    activeTab = tab;
    dialog = document.createElement('dialog');
    dialog.className = 'pro-dialog';
    dialog.setAttribute('aria-label', 'Herramientas de un clic');
    dialog.innerHTML =
      '<div class="pro-dialog-header"><div><small>HECHO PARA TU PRÓXIMA IDEA</small><h2>Listo en un clic.</h2></div>' +
      button('Volver al editor', 'close') +
      '</div><div class="pro-dialog-tabs">' +
      tabs.map(([id, label]) => button(label, 'tab', id)).join('') +
      '</div><div class="pro-dialog-layout"><section id="pro-content"></section><aside class="pro-live"><p>Vista previa de tu escena</p><canvas id="pro-mini"></canvas><small>Los estilos y ajustes se incluyen en el archivo exportado.</small><div id="pro-feedback" role="status"></div></aside></div>';
    document.body.append(dialog);
    const opened = dialog;
    opened.addEventListener(
      'close',
      () => {
        opened.remove();
        if (dialog === opened) dialog = null;
      },
      { once: true },
    );
    dialog.showModal();
    renderTab();
    preview();
  }
  function renderTab() {
    if (!dialog) return;
    dialog
      .querySelectorAll('[data-luma-action="tab"]')
      .forEach((b) => b.classList.toggle('active', b.dataset.value === activeTab));
    const target = dialog.querySelector('#pro-content');
    let html = '';
    if (activeTab === 'text')
      html =
        '<h3>16 estilos. Tu mismo mensaje.</h3><p>Aplica un estilo a la selección o añade una capa nueva.</p><div class="pro-style-grid">' +
        Core.textStyles
          .map(
            (s) =>
              '<article><button class="pro-text-sample text-' +
              s.id +
              '" style="--sample-color:' +
              s.color +
              ';--sample-fill:' +
              s.fill +
              '" data-luma-action="style" data-value="' +
              s.id +
              '"><span>' +
              s.name +
              '</span><small>Aplicar a selección</small></button>' +
              button('＋ Añadir texto', 'add-text', s.id, 'pro-add') +
              '</article>',
          )
          .join('') +
        '</div>';
    if (activeTab === 'blocks')
      html =
        '<h3>Composiciones que ya funcionan juntas.</h3><p>Se añaden como capas editables. El título anterior se conserva en una capa oculta para evitar superposiciones.</p><div class="pro-block-grid">' +
        Core.compositions
          .map(
            (b) =>
              '<button data-luma-action="block" data-value="' +
              b.id +
              '"><strong>' +
              b.icon +
              '</strong><span>' +
              b.name +
              '</span><small>' +
              b.layers.length +
              ' capas editables</small></button>',
          )
          .join('') +
        '</div><h3>Señales visuales</h3><div class="pro-inline">' +
        [
          ['arrow', '➜ Flecha'],
          ['circle', '● Círculo'],
          ['line', '━ Separador'],
          ['progress', '▰ Progreso'],
        ]
          .map(([value, name]) => button(name, 'shape', value))
          .join('') +
        '</div>';
    if (activeTab === 'quick')
      html =
        '<h3>Menos pasos, más edición.</h3><div class="pro-command-grid">' +
        [
          ['Dividir aquí', 'split', ''],
          ['Duplicar escena', 'duplicate', ''],
          ['Girar 90°', 'rotate', ''],
          ['Espejo horizontal', 'flip', 'x'],
          ['Espejo vertical', 'flip', 'y'],
          ['Texto centrado', 'align', 'center'],
          ['Selección al frente', 'order', 'front'],
          ['Selección al fondo', 'order', 'back'],
          ['Aplicar marca a todo', 'brand-all', ''],
          ['Equilibrar audio', 'audio', ''],
          ['Añadir intro de marca', 'brand-scene', 'intro'],
          ['Añadir cierre con CTA', 'brand-scene', 'outro'],
        ]
          .map(([label, action, value]) => button(label, action, value))
          .join('') +
        '</div><p class="hint">Dividir usa el punto de reproducción; si está al inicio o al final, divide por la mitad. El original de la biblioteca se conserva.</p><h3>Velocidad del video</h3><div class="pro-inline">' +
        [0.5, 1, 1.5, 2].map((v) => button(v + '×', 'speed', v)).join('') +
        '</div><h3>Movimiento de foto / video</h3><div class="pro-inline">' +
        [
          ['none', 'Sin movimiento'],
          ['zoom-in', 'Acercamiento'],
          ['zoom-out', 'Alejamiento'],
          ['pan-left', 'Panorámica ←'],
          ['pan-right', 'Panorámica →'],
        ]
          .map(([v, l]) => button(l, 'motion', v))
          .join('') +
        '</div><h3>Exportar la escena</h3><div class="pro-inline">' +
        button('PNG', 'image', 'image/png') +
        button('JPEG', 'image', 'image/jpeg') +
        button('WebP', 'image', 'image/webp') +
        button('PNG sin fondo sólido', 'transparent') +
        '</div><p class="hint">PNG sin fondo sólido conserva las capas y los medios. No elimina el fondo de una fotografía.</p>';
    if (activeTab === 'reel')
      html =
        '<h3>Arma un Reel con tus medios.</h3><p>Selecciona archivos en el orden deseado. Luma asigna duraciones por BPM y añade movimiento a las fotos.</p><div class="pro-form-row"><label>BPM<input id="pro-bpm" type="number" min="40" max="220" value="100"></label><label>Pulsos por escena<select id="pro-beats"><option value="2">2 pulsos</option><option value="4" selected>4 pulsos</option><option value="8">8 pulsos</option></select></label></div><div class="pro-asset-list">' +
        assets
          .filter((a) => /^(image|video)/.test(a.type))
          .map(
            (a) =>
              '<label><input type="checkbox" data-pro-media="' +
              a.id +
              '" ' +
              (selectedMedia.has(a.id) ? 'checked' : '') +
              '><span>' +
              (a.type.startsWith('image') ? '▧' : '▶') +
              ' ' +
              esc(a.name) +
              '</span></label>',
          )
          .join('') +
        '</div><div class="pro-inline">' +
        button('Crear montaje nuevo', 'assemble') +
        button('Ajustar escenas actuales al BPM', 'fit-beat') +
        '</div><p class="hint">Usa el BPM que indiques; no detecta golpes de una canción automáticamente. Los clips cortos se respetan y el montaje tiene un máximo de 120 s.</p>';
    if (activeTab === 'adjust') {
      const a = p().adjust || {};
      html =
        '<h3>El acabado de tu imagen.</h3><div class="pro-adjust-grid">' +
        [
          ['contrast', 'Contraste', 50, 180, a.contrast ?? 100],
          ['hue', 'Matiz', -180, 180, a.hue || 0],
          ['temperature', 'Tono cálido / frío', -100, 100, a.temperature || 0],
          ['blur', 'Desenfoque', 0, 12, a.blur || 0],
          ['vignette', 'Viñeta', 0, 100, a.vignette || 0],
          ['grain', 'Grano', 0, 100, a.grain || 0],
        ]
          .map(
            ([key, label, min, max, value]) =>
              '<label>' +
              label +
              '<output id="pro-out-' +
              key +
              '">' +
              value +
              '</output><input type="range" data-pro-adjust="' +
              key +
              '" min="' +
              min +
              '" max="' +
              max +
              '" step="1" value="' +
              value +
              '"></label>',
          )
          .join('') +
        '</div><label class="pro-strength">Intensidad del filtro<input type="range" data-pro-field="filterStrength" min="0" max="1" step=".05" value="' +
        (p().filterStrength ?? 1) +
        '"></label><h3>24 filtros de color</h3><div class="pro-filter-grid">' +
        P.filters
          .map(
            (f) =>
              '<button style="--filter-color:' +
              f.swatch +
              '" data-luma-action="filter" data-value="' +
              f.id +
              '"><i></i><span>' +
              f.name +
              '</span></button>',
          )
          .join('') +
        '</div><h3>Fondos listos</h3><div class="pro-inline">' +
        [
          ['solid', 'Color actual'],
          ['aurora', 'Aurora'],
          ['sunset', 'Atardecer'],
          ['paper', 'Papel'],
          ['midnight', 'Medianoche'],
        ]
          .map(([v, l]) => button(l, 'background', v))
          .join('') +
        '</div><div class="pro-inline">' +
        button('Restablecer ajustes de imagen', 'reset-adjust') +
        '</div>';
    }
    if (activeTab === 'captions')
      html =
        '<h3>Subtítulos que se leen en el celular.</h3><p>Aplica el estilo al SRT de tu escena. Para crear bloques, pega el guion.</p><div class="pro-caption-styles">' +
        [
          ['dark', 'Caja oscura'],
          ['plain', 'Blanco'],
          ['yellow', 'Amarillo'],
          ['karaoke', 'Palabra resaltada'],
          ['outline', 'Contorno'],
          ['pill', 'Píldora violeta'],
          ['mint', 'Menta'],
          ['magenta', 'Magenta'],
        ]
          .map(([id, name]) => button(name, 'caption-style', id))
          .join('') +
        '</div><label for="pro-caption-copy">Guion de esta escena</label><textarea id="pro-caption-copy" placeholder="Pega aquí el texto que se escucha…"></textarea><label for="pro-words">Palabras por bloque<select id="pro-words"><option value="3">3 palabras</option><option value="4" selected>4 palabras</option><option value="6">6 palabras</option></select></label><div class="pro-inline">' +
        button('Crear bloques con tiempos', 'captions') +
        '</div><p class="hint">Distribuye el texto de forma uniforme. Revisa los tiempos con tu audio. El resaltado por palabra también usa los tiempos del bloque; no transcribe voz ni analiza fonemas.</p>';
    if (activeTab === 'mine')
      html =
        '<h3>Tu biblioteca de elementos reutilizables.</h3><p>Guarda un texto, forma, sticker o temporizador de la selección actual.</p>' +
        button('＋ Guardar selección', 'favorite-save') +
        '<div class="pro-saved-grid">' +
        favoriteItems()
          .map(
            (f, i) =>
              '<article><strong>' +
              esc(f.name) +
              '</strong><p>' +
              esc(f.layer.text || f.layer.kind) +
              '</p>' +
              button('Añadir al lienzo', 'favorite-add', i) +
              button('Quitar de mis elementos', 'favorite-remove', i) +
              '</article>',
          )
          .join('') +
        '</div>';
    if (activeTab === 'review') {
      const report = Core.audit(p(), assets);
      html =
        '<h3>Revisión técnica antes de exportar.</h3><div class="pro-score"><strong>' +
        report.score +
        '%</strong><span>' +
        report.total.toFixed(1) +
        ' s · ' +
        p().scenes.length +
        ' escenas</span></div><ul class="pro-review">' +
        (report.errors.length || report.warnings.length
          ? [
              ...report.errors.map((t) => '<li class="error">✕ ' + esc(t) + '</li>'),
              ...report.warnings.map((t) => '<li>△ ' + esc(t) + '</li>'),
            ].join('')
          : '<li class="ok">✓ No se detectaron problemas en estas comprobaciones.</li>') +
        '</ul><p class="hint">Comprueba archivos, recortes, SRT, tiempos y contraste sobre fondos sólidos. La revisión final del contenido y sus derechos sigue siendo tuya.</p><div class="pro-inline">' +
        button('Abrir preparación para redes', 'publish') +
        button('Exportar montaje', 'export') +
        '</div>';
    }
    target.innerHTML = html;
    preview();
  }
  function preview() {
    const canvas = dialog?.querySelector('#pro-mini');
    if (!canvas || !p()) return;
    [canvas.width, canvas.height] = C.dimensions(p().format, 230);
    const media = previewMedia?.readyState >= 2 ? previewMedia : imageObj;
    LumaCompositor.paint(
      canvas.getContext('2d'),
      p(),
      media,
      Math.max(1, currentTime()),
      assetImages,
    );
  }
  function currentTime() {
    return previewMedia
      ? Math.max(0, (previewMedia.currentTime - p().start) / (p().speed || 1))
      : previewSeconds || 0;
  }
  function selectionLayer() {
    const l = currentLayer();
    if (l) return l;
    return P.layer({
      kind: 'text',
      text: p().text,
      x: p().textX,
      y: p().textY,
      size: p().fontSize,
      color: p().color,
      fill: p().bg,
      style: p().titleStyle,
    });
  }
  function applyStyle(id) {
    const style = Core.textStyles.find((s) => s.id === id);
    if (!style) return;
    const l = currentLayer();
    if (l && !['text', 'counter'].includes(l.kind))
      throw Error('Selecciona un texto o añade una capa de texto nueva.');
    if (l) {
      l.style = id;
      l.color = style.color;
      l.fill = style.fill;
    } else {
      if (!p().text.trim()) p().text = 'Tu próximo título';
      p().titleStyle = id;
      p().color = style.color;
      if (['boxed', 'label', 'stamp'].includes(id)) p().bg = style.fill;
    }
    commit();
  }
  function addText(id) {
    if (p().layers.length >= 40) throw Error('Máximo 40 capas por escena.');
    const style = Core.textStyles.find((s) => s.id === id) || Core.textStyles[0];
    const layer = P.layer({
      text: 'Tu texto aquí',
      style: style.id,
      color: style.color,
      fill: style.fill,
      size: 72,
    });
    p().layers.push(layer);
    selectedLayer = layer.id;
    commit();
    close();
  }
  function addBlock(id) {
    const block = Core.compositions.find((b) => b.id === id);
    if (!block) return;
    if (p().layers.length + block.layers.length + (p().text.trim() ? 1 : 0) > 40)
      throw Error('No queda espacio para todas las capas del bloque.');
    if (p().text.trim()) {
      p().layers.push(
        P.layer({
          text: p().text,
          x: p().textX,
          y: p().textY,
          size: p().fontSize,
          color: p().color,
          style: p().titleStyle,
          hidden: true,
        }),
      );
      p().text = '';
    }
    const layers = block.layers.map((v) => {
      const style = Core.textStyles.find((s) => s.id === v.style);
      return P.layer({
        ...v,
        color: style?.color || '#fff',
        fill: v.fill || style?.fill || brand().primary,
      });
    });
    p().layers.push(...layers);
    selectedLayer = layers.find((l) => l.kind !== 'shape')?.id || layers[0].id;
    commit();
    close();
    notify('Bloque añadido. Cada capa se puede editar.');
  }
  function addShape(shape) {
    const layer = P.layer({
      kind: 'shape',
      shape,
      width: shape === 'circle' ? 30 : 70,
      height: shape === 'line' ? 2 : shape === 'progress' ? 2 : 20,
      fill: brand().primary,
    });
    p().layers.push(layer);
    selectedLayer = layer.id;
    commit();
    close();
  }
  function split() {
    P.mirror(p());
    const scene = activeScene(),
      total = P.length(scene);
    let at = currentTime();
    if (at < 0.1 || at > total - 0.1) at = total / 2;
    const scenes = Core.splitScene(scene, at),
      index = p().scenes.findIndex((s) => s.id === scene.id);
    if (p().scenes.length >= 24) throw Error('Máximo 24 escenas.');
    p().scenes.splice(index, 1, ...scenes);
    P.activate(p(), scenes[0].id, false);
    selectedLayer = 'base';
    commit(true);
    close();
    notify('Escena dividida en dos fragmentos.');
  }
  function align(value) {
    const l = currentLayer();
    const position = { left: 20, center: 50, right: 80 };
    if (l) l.x = position[value] ?? 50;
    else p().textX = position[value] ?? 50;
    commit();
  }
  function order(value) {
    const l = currentLayer();
    if (!l) throw Error('Selecciona una capa adicional primero.');
    const list = p().layers;
    list.splice(list.indexOf(l), 1);
    value === 'front' ? list.push(l) : list.unshift(l);
    commit();
  }
  function brandAll() {
    P.mirror(p());
    const b = brand();
    p().scenes.forEach((s) => {
      s.bg = b.primary;
      s.background = 'solid';
      s.color = '#ffffff';
      s.layers.forEach((l) => {
        if (l.kind === 'shape') l.fill = b.secondary;
      });
    });
    P.activate(p(), p().activeScene, false);
    commit(true);
    notify('Colores aplicados a todas las escenas.');
  }
  function brandScene(value) {
    if (p().scenes.length >= 24) throw Error('Máximo 24 escenas.');
    P.mirror(p());
    const b = brand(),
      s = P.scene({
        name: value === 'intro' ? 'Intro de marca' : 'Cierre con CTA',
        bg: b.primary,
        text: value === 'intro' ? b.name : b.cta,
        duration: 3,
        background: 'solid',
        titleStyle: 'outline',
        layers: [
          P.layer({
            text: value === 'intro' ? 'UNA HISTORIA DE ' + b.name : b.hashtags,
            y: 78,
            size: 30,
            animation: 'fade',
          }),
        ],
      });
    value === 'intro' ? p().scenes.unshift(s) : p().scenes.push(s);
    P.activate(p(), s.id, false);
    selectedLayer = 'base';
    commit(true);
    close();
  }
  async function exportStill(type = 'image/png', transparent = false) {
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = C.dimensions(p().format, 1080);
    LumaCompositor.paint(
      canvas.getContext('2d'),
      p(),
      previewMedia?.readyState >= 2 ? previewMedia : imageObj,
      Math.max(1, currentTime()),
      assetImages,
      { transparent },
    );
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.93));
    if (!blob) throw Error('No se pudo crear la imagen.');
    const actual = blob.type,
      ext = actual === 'image/jpeg' ? 'jpg' : actual === 'image/webp' ? 'webp' : 'png';
    download(blob, p().name + (transparent ? '-sin-fondo' : '') + '.' + ext);
    notify('Imagen exportada.');
  }
  async function videoDuration(asset) {
    if (!asset.type.startsWith('video')) return 0;
    const v = document.createElement('video');
    v.preload = 'auto';
    const loaded = waitMedia(v, 'loadeddata', 20000);
    v.src = asset.url;
    v.load();
    try {
      await loaded;
      if (!Number.isFinite(v.duration)) await seekMedia(v, 10000000);
      return v.duration;
    } finally {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
  }
  async function assemble(fitExisting = false) {
    const bpm = +dialog.querySelector('#pro-bpm').value,
      beats = +dialog.querySelector('#pro-beats').value,
      seconds = Core.beatDuration(bpm, beats);
    if (fitExisting) {
      P.mirror(p());
      const list = structuredClone(p().scenes);
      for (const scene of list) {
        const a = assets.find((a) => a.id === scene.asset);
        if (a?.type.startsWith('video') && !scene.sourceDuration)
          scene.sourceDuration = await videoDuration(a);
      }
      const fitted = list.map((s) => Core.fitToBeat(s, bpm, beats));
      if (fitted.reduce((n, s) => n + P.length(s), 0) > 120)
        throw Error('El montaje supera 120 segundos.');
      p().scenes = fitted;
      P.activate(p(), p().activeScene, false);
      commit(true);
      close();
      notify('Duraciones ajustadas a ' + bpm + ' BPM.');
      return;
    }
    const list = [...selectedMedia].map((id) => assets.find((a) => a.id === id)).filter(Boolean);
    if (!list.length) throw Error('Selecciona fotos o videos.');
    if (list.length > 24) throw Error('Selecciona como máximo 24 medios.');
    const scenes = [];
    for (const [i, a] of list.entries()) {
      const sourceDuration = await videoDuration(a);
      scenes.push(
        P.scene({
          name: 'Clip ' + (i + 1),
          asset: a.id,
          text: '',
          sourceDuration,
          end: sourceDuration ? Math.min(sourceDuration, seconds) : 0,
          duration: seconds,
          motion: sourceDuration ? 'none' : i % 2 ? 'pan-left' : 'zoom-in',
          transition: i ? 'fade' : 'cut',
        }),
      );
    }
    if (scenes.reduce((n, s) => n + P.length(s), 0) > 120)
      throw Error('El montaje supera 120 segundos. Usa menos medios o menos pulsos.');
    const original = p(),
      project = C.normalize({
        name: 'Reel · ' + bpm + ' BPM',
        format: '9:16',
        platform: 'Instagram',
        caption: brand().cta + '\n' + brand().hashtags,
        volume: 1,
        musicVolume: 0.3,
      });
    project.scenes = scenes;
    project.activeScene = scenes[0].id;
    project.audio = original.audio;
    project.musicLoop = true;
    P.activate(project, project.activeScene, false);
    projects.unshift(project);
    current = project.id;
    selectedLayer = 'base';
    history = [];
    future = [];
    save();
    close();
    go('editor');
    notify('Montaje creado con ' + scenes.length + ' escenas.');
  }
  function favoriteSave() {
    const layer = selectionLayer();
    if (layer.kind === 'image')
      throw Error('Para reutilizar una imagen, usa la biblioteca multimedia.');
    const items = favoriteItems();
    items.unshift({ name: (layer.text || layer.kind).slice(0, 40), layer: structuredClone(layer) });
    saveFavorites(items);
    renderTab();
    notify('Elemento guardado en Mis elementos.');
  }
  function favoriteAdd(index) {
    const item = favoriteItems()[+index];
    if (!item) return;
    if (p().layers.length >= 40) throw Error('Máximo 40 capas por escena.');
    const layer = P.layer(item.layer);
    p().layers.push(layer);
    selectedLayer = layer.id;
    commit();
    close();
  }
  function captionsFromCopy() {
    const text = dialog.querySelector('#pro-caption-copy').value,
      count = +dialog.querySelector('#pro-words').value;
    p().subtitles = Core.timedCaptions(text, P.length(p()), count);
    commit(true);
    notify('Bloques creados. Revisa los tiempos con tu audio.');
  }
  const actions = {
    close: close,
    tab: (value) => {
      activeTab = value;
      renderTab();
    },
    style: applyStyle,
    'add-text': addText,
    block: addBlock,
    shape: addShape,
    split: split,
    duplicate: () => {
      duplicateScene();
      close();
    },
    rotate: () => {
      p().rotation = ((p().rotation || 0) + 90) % 360;
      commit();
    },
    flip: (value) => {
      const key = value === 'x' ? 'flipX' : 'flipY';
      p()[key] = !p()[key];
      commit();
    },
    align: align,
    order: order,
    'brand-all': brandAll,
    'brand-scene': brandScene,
    audio: () => {
      p().volume = 0.85;
      p().musicVolume = 0.22;
      p().ducking = true;
      p().musicLoop = true;
      commit();
      notify('Mezcla equilibrada y atenuación musical activadas.');
    },
    speed: (value) => {
      if (!assets.find((a) => a.id === p().asset)?.type.startsWith('video'))
        throw Error('La velocidad se aplica a escenas con video.');
      p().speed = +value;
      if (previewMedia) previewMedia.playbackRate = +value;
      commit();
      notify('Velocidad: ' + value + '×');
    },
    motion: (value) => {
      p().motion = value;
      commit();
    },
    image: (type) => exportStill(type),
    transparent: () => exportStill('image/png', true),
    filter: (value) => {
      p().filter = value;
      commit();
    },
    background: (value) => {
      p().background = value;
      if (value === 'paper') {
        p().bg = '#f0e8d9';
        p().color = '#34383c';
      } else if (value !== 'solid') p().color = '#ffffff';
      commit();
    },
    'reset-adjust': () => {
      p().adjust = P.scene({}).adjust;
      p().filterStrength = 1;
      p().brightness = p().saturation = 100;
      p().filter = 'original';
      p().rotation = 0;
      p().flipX = p().flipY = false;
      commit();
      renderTab();
    },
    assemble: () => assemble(false),
    'fit-beat': () => assemble(true),
    'caption-style': (value) => {
      p().subtitleStyle = value;
      commit();
    },
    captions: captionsFromCopy,
    'favorite-save': favoriteSave,
    'favorite-add': favoriteAdd,
    'favorite-remove': (index) => {
      const items = favoriteItems();
      items.splice(+index, 1);
      saveFavorites(items);
      renderTab();
    },
    publish: () => {
      close();
      queueCurrent();
    },
    export: () => {
      close();
      exportVideo();
    },
    'save-selection': favoriteSave,
  };
  document.addEventListener('click', async (event) => {
    const control = event.target.closest('[data-luma-action]');
    if (!control) return;
    const action = actions[control.dataset.lumaAction];
    if (!action) return;
    if (control.dataset.lumaAction === 'close' || control.dataset.lumaAction === 'tab') {
      action(control.dataset.value);
      return;
    }
    try {
      requireProject();
      control.disabled = true;
      await action(control.dataset.value);
    } catch (error) {
      notify(error.message);
      const feedback = dialog?.querySelector('#pro-feedback');
      if (feedback) feedback.textContent = error.message;
    } finally {
      if (control.isConnected) control.disabled = false;
    }
  });
  document.addEventListener('input', (event) => {
    const el = event.target;
    if (el.dataset.proAdjust) {
      p().adjust[el.dataset.proAdjust] = +el.value;
      const output = dialog?.querySelector('#pro-out-' + el.dataset.proAdjust);
      if (output) output.textContent = el.value;
      save();
      remember();
      draw();
      preview();
    }
    if (el.dataset.proField) {
      p()[el.dataset.proField] = +el.value;
      save();
      remember();
      draw();
      preview();
    }
  });
  document.addEventListener('change', (event) => {
    const el = event.target;
    if (el.dataset.proMedia) {
      el.checked
        ? selectedMedia.add(el.dataset.proMedia)
        : selectedMedia.delete(el.dataset.proMedia);
    }
    if (el.dataset.proLayerField) {
      const l = currentLayer();
      if (!l) return;
      const key = el.dataset.proLayerField;
      l[key] = key === 'style' ? el.value : +el.value;
      commit();
    }
    if (el.dataset.proTitleStyle) {
      p().titleStyle = el.value;
      commit();
    }
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      open();
    }
  });
  function mountInspector() {
    if (!p()) return;
    document.querySelector('#pro-selection-controls')?.remove();
    document.querySelector('#pro-title-controls')?.remove();
    const layer = currentLayer(),
      options = Core.textStyles
        .map((s) => '<option value="' + s.id + '">' + s.name + '</option>')
        .join('');
    if (layer) {
      const box = document.createElement('section');
      box.id = 'pro-selection-controls';
      box.className = 'pro-selection-controls';
      box.innerHTML =
        '<h4>Estilo y tiempo</h4><label>Estilo de texto<select data-pro-layer-field="style">' +
        options +
        '</select></label><label>Visible desde (s)<input type="number" min="0" max="120" step=".1" data-pro-layer-field="startAt" value="' +
        (layer.startAt || 0) +
        '"></label><label>Visible hasta (0 = fin)<input type="number" min="0" max="120" step=".1" data-pro-layer-field="endAt" value="' +
        (layer.endAt || 0) +
        '"></label><label>Duración de entrada (s)<input type="number" min=".1" max="4" step=".1" data-pro-layer-field="animationDuration" value="' +
        (layer.animationDuration || 0.55) +
        '"></label>' +
        button('Guardar este elemento', 'save-selection');
      box.querySelector('select').value = layer.style || 'clean';
      document.querySelector('#layerInspector')?.append(box);
    } else {
      const box = document.createElement('section');
      box.id = 'pro-title-controls';
      box.innerHTML =
        '<label>Efecto del título<select data-pro-title-style="true">' +
        options +
        '</select></label>';
      box.querySelector('select').value = p().titleStyle || 'clean';
      document.querySelector('.design-inspector')?.append(box);
    }
  }
  async function waveform() {
    const track = document.querySelector('.audio-track'),
      asset = assets.find((a) => a.id === p()?.audio);
    if (!track || !asset) return;
    let canvas = document.querySelector('#pro-wave');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'pro-wave';
      canvas.width = 600;
      canvas.height = 36;
      canvas.setAttribute('aria-label', 'Forma de onda de ' + asset.name);
      track.append(canvas);
    }
    try {
      if (!waveforms.has(asset.id))
        waveforms.set(
          asset.id,
          (async () => {
            const ac = new AudioContext();
            try {
              const data = await ac.decodeAudioData(await asset.blob.arrayBuffer()),
                samples = data.getChannelData(0),
                peaks = [];
              for (let i = 0; i < 200; i++) {
                const start = Math.floor((i * samples.length) / 200),
                  end = Math.floor(((i + 1) * samples.length) / 200);
                let max = 0;
                for (let j = start; j < end; j += Math.max(1, Math.floor((end - start) / 100)))
                  max = Math.max(max, Math.abs(samples[j]));
                peaks.push(max);
              }
              return peaks;
            } finally {
              await ac.close();
            }
          })(),
        );
      const peaks = await waveforms.get(asset.id);
      if (!canvas.isConnected) return;
      const ctx = canvas.getContext('2d'),
        max = Math.max(0.01, ...peaks);
      ctx.clearRect(0, 0, 600, 36);
      ctx.fillStyle = '#8aab7a';
      peaks.forEach((v, i) => {
        const h = Math.max(1, (v / max) * 32);
        ctx.fillRect(i * 3, 18 - h / 2, 2, h);
      });
    } catch {
      canvas.remove();
    }
  }
  function mount() {
    if (!p() || !document.querySelector('.creator-workspace')) return;
    if (!document.querySelector('#pro-open-tools')) {
      const b = document.createElement('button');
      b.id = 'pro-open-tools';
      b.type = 'button';
      b.className = 'pro-open-tools';
      b.textContent = '⚡ Listo en un clic';
      b.onclick = () => open();
      document.querySelector('main > .actions')?.prepend(b);
      const quick = document.createElement('button');
      quick.className = 'pro-palette-shortcut';
      quick.textContent = '✦ Estilos y bloques listos';
      quick.onclick = () => open('blocks');
      document.querySelector('.tool-tabs')?.before(quick);
    }
    mountInspector();
    waveform();
  }
  root.LumaPro = { open, close, mount, preview };
  for (const filter of Core.extraFilters)
    if (!P.filters.some((f) => f.id === filter.id)) P.filters.push(filter);
  for (const project of projects) {
    P.ensure(project);
    for (const scene of project.scenes) {
      const defaults = P.scene(scene);
      for (const key of Core.extraSceneKeys)
        if (scene[key] === undefined) scene[key] = defaults[key];
      scene.layers.forEach((layer) => {
        const d = P.layer(layer);
        for (const key of Core.layerKeys) if (layer[key] === undefined) layer[key] = d[key];
      });
    }
    P.activate(project, project.activeScene, false);
  }
  const renderEditorBase = renderEditor;
  renderEditor = function () {
    renderEditorBase();
    mount();
  };
  const renderInspectorBase = renderLayerInspector;
  renderLayerInspector = function () {
    renderInspectorBase();
    mountInspector();
  };
  const renderTimelineBase = renderTimeline;
  renderTimeline = function () {
    renderTimelineBase();
    waveform();
  };
  const makeBackupBase = makeBackup;
  makeBackup = async function (list) {
    const backup = await makeBackupBase(list);
    backup.creator.pro = { elements: favoriteItems() };
    return backup;
  };
  const restoreBase = restoreCreatorBackup;
  restoreCreatorBackup = function (backup, restored, mediaIds) {
    restoreBase(backup, restored, mediaIds);
    const entries = backup.creator?.pro?.elements;
    if (Array.isArray(entries)) {
      const existing = favoriteItems();
      for (const item of entries.slice(0, 30)) {
        const layer = P.layer(item.layer);
        if (layer.kind !== 'image')
          existing.push({ name: String(item.name || layer.text).slice(0, 40), layer });
      }
      saveFavorites(existing);
    }
  };
  durationOf = function () {
    const scene = p();
    if (!scene) throw Error('Abre un proyecto.');
    const duration = P.length(scene);
    if (!(duration > 0)) throw Error('Revisa el recorte.');
    return duration;
  };
  if (view === 'editor') renderEditor();
})(globalThis);
