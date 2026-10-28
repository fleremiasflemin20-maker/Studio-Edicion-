(function (root) {
  'use strict';
  const K = FleremahiasCreatorKit,
    L = FleremahiasLibrary,
    E = FleremahiasEditorKit,
    key = 'fleremahias-creator-kit-v1',
    t = (es, en) => (StudioI18n.locale() === 'en' ? en : es);
  let state;
  try {
    state = JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    state = {};
  }
  state.brand = K.brand(state.brand);
  state.recipes = Array.isArray(state.recipes) ? state.recipes.slice(0, 24) : [];
  state.filters = Array.isArray(state.filters) ? state.filters.slice(0, 40) : [];
  state.favorites = Array.isArray(state.favorites) ? state.favorites.slice(0, 300) : [];
  let modal,
    tab = 'library',
    category = 'background',
    query = '',
    page = 0,
    busy = false,
    abort,
    previewURL,
    soundPreview,
    semantic = [],
    groups = [],
    order = [],
    cutout,
    brushes = [],
    recipeId = 'recipe-product',
    waves = new Map();
  const name = (i) => (StudioI18n.locale() === 'en' ? i.nameEn : i.name),
    persist = () => localStorage.setItem(key, JSON.stringify(state));
  const b = (label, action, value = '', extra = '') =>
    `<button type="button" data-kit="${action}" data-value="${esc(value)}" ${extra}>${label}</button>`;
  const field = (label, body) => `<label>${label}${body}</label>`,
    input = (id, v = '', type = 'text', extra = '') =>
      `<input id="kit-${id}" type="${type}" value="${esc(v)}" ${extra}>`,
    select = (id, opts, v) =>
      `<select id="kit-${id}">${opts.map(([k, n]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`,
    val = (id) => modal.querySelector('#kit-' + id)?.value || '';
  const status = (s) => {
    if (modal) modal.querySelector('[role=status]').textContent = s;
    else toast(s);
  };
  const media = (id, type, v, empty = false) =>
    select(
      id,
      [
        ...(empty ? [['', t('Ninguno', 'None')]] : []),
        ...assets
          .filter((a) => new RegExp('^(' + type + ')').test(a.type))
          .map((a) => [a.id, a.name]),
      ],
      v,
    );
  function project() {
    if (!p()) throw Error(t('Abre un proyecto en el editor.', 'Open a project in the editor.'));
    if (rendering || batchBusy || labBusy)
      throw Error(t('Termina el proceso activo.', 'Finish the active process.'));
    return P.ensure(p());
  }
  function commit(fn) {
    const x = project();
    P.mirror(x);
    const before = JSON.stringify(x);
    try {
      fn(x);
      if (P.layout(x.scenes).at(-1).end > 120) throw Error('Maximum 120 seconds');
      P.activate(x, x.activeScene, false);
      clearTimeout(historyTimer);
      if (history.at(-1) !== before) history.push(before);
      if (history.length > 40) history.shift();
      future = [];
      save();
      renderEditor();
      status(t('Cambios aplicados. Puedes deshacer.', 'Changes applied. You can undo.'));
    } catch (e) {
      Object.assign(x, JSON.parse(before));
      throw e;
    }
  }
  function make(scenes, title, format = '9:16', caption = '') {
    if (!scenes.length || scenes.length > 24 || P.layout(scenes).at(-1).end > 120)
      throw Error(t('Máximo 24 escenas y 120 segundos.', 'Maximum 24 scenes and 120 seconds.'));
    const x = {
      id: crypto.randomUUID(),
      name: title.slice(0, 80),
      format,
      platform: format === '16:9' ? 'YouTube' : 'Instagram',
      caption,
      status: 'Borrador',
      created: Date.now(),
      scenes,
      activeScene: scenes[0].id,
      volume: 1,
      musicVolume: 0.25,
      musicLoop: true,
      ducking: true,
      audioTracks: [],
    };
    P.activate(x, x.activeScene, false);
    projects.unshift(x);
    current = x.id;
    save();
    go('editor');
    return x;
  }
  function close() {
    if (busy)
      return status(t('Cancela el proceso antes de cerrar.', 'Cancel the process before closing.'));
    modal?.close();
    soundPreview?.pause();
  }
  async function job(fn) {
    if (busy) return;
    busy = true;
    abort = new AbortController();
    modal.querySelector('[data-kit=cancel]').disabled = false;
    try {
      await fn(abort.signal);
    } catch (e) {
      status(abort.signal.aborted ? t('Proceso cancelado.', 'Process canceled.') : e.message);
    } finally {
      busy = false;
      modal.querySelector('[data-kit=cancel]').disabled = true;
    }
  }
  function open(next = 'library') {
    if (busy) return;
    tab = next;
    if (!modal) {
      modal = document.createElement('dialog');
      modal.className = 'creator-kit';
      modal.innerHTML = `<header><div><small>FLEREMAHIAS · CREATIVE LIBRARY</small><h2>${t('Tu próxima idea empieza aquí.', 'Your next idea starts here.')}</h2></div>${b('?', 'help')}${b(t('Volver al estudio', 'Back to studio'), 'close')}</header><nav class="kit-tabs"></nav><div class="kit-body"></div><footer><span role="status" aria-live="polite"></span>${b(t('Cancelar proceso', 'Cancel process'), 'cancel', '', 'disabled')}</footer>`;
      document.body.append(modal);
      modal.onclick = click;
      modal.oncancel = (e) => {
        if (busy) e.preventDefault();
      };
      modal.onchange = (e) => {
        if (e.target.id === 'kit-category') {
          category = e.target.value;
          page = 0;
          cards();
        }
        if (['kit-accent', 'kit-background'].includes(e.target.id)) cards();
        if (e.target.id === 'kit-key-layer') showKeys();
      };
      modal.ondragstart = (e) => {
        const card = e.target.closest('[data-resource]');
        if (card)
          e.dataTransfer.setData('application/x-fleremahias-resource', card.dataset.resource);
      };
      modal.ondragover = (e) => {
        if (e.target.closest('.kit-drop')) e.preventDefault();
      };
      modal.ondrop = async (e) => {
        const id = e.dataTransfer.getData('application/x-fleremahias-resource');
        if (id && e.target.closest('.kit-drop')) {
          e.preventDefault();
          try {
            await insert(id);
          } catch (error) {
            status(error.message);
          }
        }
      };
    }
    paint();
    if (!modal.open) modal.showModal();
  }
  function paint() {
    const tabs = [
      ['library', 'Biblioteca', 'Library'],
      ['brand', 'Mi identidad', 'My brand'],
      ['recipes', 'Recetas', 'Recipes'],
      ['filters', 'Filtros propios', 'Custom filters'],
      ['timeline', 'Tiempo y movimiento', 'Timing and motion'],
      ['text', 'Editar por texto', 'Edit by text'],
      ['cutout', 'Quitar fondo', 'Remove background'],
      ['review', 'Revisar y adaptar', 'Review and resize'],
      ['cloud', 'Catálogo y revisión', 'Catalog and review'],
    ];
    modal.querySelector('.kit-tabs').innerHTML = tabs
      .map(([id, es, en]) => b(t(es, en), 'tab', id, `class="${id === tab ? 'active' : ''}"`))
      .join('');
    modal.querySelector('.kit-body').innerHTML = panels[tab]();
    if (tab === 'library') cards();
    if (tab === 'filters') filterPreview();
    if (tab === 'timeline') {
      drawWave();
      showKeys();
    }
    if (tab === 'text') textRows();
    if (tab === 'cutout') showCutout();
  }
  function recipeFields() {
    return `${field(t('Título o gancho', 'Title or hook'), input('hook', p()?.text || ''))}${field(t('Beneficio, precio o cierre', 'Benefit, price or closing'), input('cta', state.brand.closing))}${field(
      t('Formato', 'Aspect ratio'),
      select(
        'format',
        ['9:16', '1:1', '4:5', '16:9'].map((v) => [v, v]),
        '9:16',
      ),
    )}${field(t('Pasos o cifras 3D, una línea por elemento', 'Steps or 3D figures, one item per line'), '<textarea id="kit-lines" rows="4"></textarea>')}<div class="kit-media-picks">${
      assets
        .filter((a) => /^(image|video|audio)/.test(a.type))
        .map((a) => `<label><input type="checkbox" data-pick="${a.id}">${esc(a.name)}</label>`)
        .join('') ||
      t('Importa archivos en Medios para comenzar.', 'Import files into Media to begin.')
    }</div>${b(t('Crear proyecto editable', 'Create editable project'), 'build')}`;
  }
  const panels = {
    library: () =>
      `<div class="kit-toolbar">${input('search', query, 'search', `placeholder="${t('Pintura, podcast, sin destello…', 'Paint, podcast, no flash…')}" aria-label="Resource search"`)}${b(t('Buscar', 'Search'), 'search')}${select(
        'category',
        [
          ['background', t('Fondos', 'Backgrounds')],
          ['element', t('Elementos', 'Elements')],
          ['style', t('Estilos', 'Styles')],
          ['title', t('Títulos', 'Titles')],
          ['transition', t('Transiciones', 'Transitions')],
          ['sound', t('Sonidos', 'Sounds')],
          ['recipe', t('Recetas completas', 'Complete recipes')],
          ['favorites', t('Favoritos', 'Favorites')],
        ],
        category,
      )}${field(t('Color', 'Color'), input('accent', state.brand.primary, 'color'))}${field(t('Fondo', 'Background'), input('background', state.brand.background, 'color'))}</div><div class="kit-drop">${t('Arrastra aquí un recurso o pulsa Insertar para añadirlo al proyecto abierto.', 'Drag a resource here or click Insert to add it to your open project.')}</div><div class="kit-grid" id="kit-cards"></div><div class="kit-toolbar">${b('←', 'page', -1)}<span id="kit-page"></span>${b('→', 'page', 1)}${b(t('Importar archivos', 'Import files'), 'import-media')}</div>`,
    brand: () =>
      `${field(t('Nombre de marca', 'Brand name'), input('brand-name', state.brand.name))}<div class="kit-columns">${[
        ['primary', 'Principal', 'Primary'],
        ['background', 'Fondo', 'Background'],
        ['text', 'Texto', 'Text'],
      ]
        .map(([k, es, en]) => field(t(es, en), input('brand-' + k, state.brand[k], 'color')))
        .join('')}</div>${field(
        t('Tipografía', 'Typeface'),
        select(
          'brand-font',
          [
            ['sans-serif', 'Sans'],
            ['serif', 'Serif'],
            ['monospace', 'Mono'],
          ],
          state.brand.font,
        ),
      )}${field('Logo', media('brand-logo', 'image', state.brand.logo, true))}${field(t('Texto de cierre', 'Closing message'), input('brand-closing', state.brand.closing))}<div class="kit-toolbar">${b(t('Guardar identidad', 'Save brand'), 'brand-save')}${b(t('Aplicar al proyecto completo', 'Apply to entire project'), 'brand-apply')}${b(t('Añadir cierre de marca', 'Add branded outro'), 'brand-outro')}</div><p>${t('Colores, tipografía y logo en todas las escenas. Conserva tus textos y permite deshacer.', 'Colors, typography and logo across all scenes. Preserves your text and supports undo.')}</p>`,
    recipes: () =>
      `${field(t('Nombre de mi receta', 'My recipe name'), input('recipe-name', p()?.name || ''))}${b(t('Guardar receta del proyecto', 'Save project recipe'), 'recipe-save')}${b(t('Importar receta JSON', 'Import recipe JSON'), 'recipe-import')}<div class="kit-list">${state.recipes.map((r) => `<article><strong>${esc(r.name)}</strong>${b(t('Aplicar', 'Apply'), 'recipe-apply', r.id)}${b('JSON ↓', 'recipe-export', r.id)}${b('×', 'recipe-remove', r.id)}</article>`).join('')}</div><h3>${t('Recetas completas', 'Complete recipes')}</h3>${select(
        'recipe',
        L.catalog.filter((i) => i.type === 'recipe').map((i) => [i.id, name(i)]),
        recipeId,
      )}${recipeFields()}`,
    filters: () => {
      const f = E.normalizeFilter(p()?.customFilter || {});
      return `<div class="kit-filter-layout"><div>${field(t('Nombre del filtro', 'Filter name'), input('filter-name', f.name))}${[
        ['exposure', -2, 2, 0.1, 'Exposición', 'Exposure'],
        ['contrast', 50, 180, 1, 'Contraste', 'Contrast'],
        ['saturation', 0, 200, 1, 'Saturación', 'Saturation'],
        ['temperature', -100, 100, 1, 'Temperatura', 'Temperature'],
        ['gamma', 0.2, 3, 0.05, 'Gamma', 'Gamma'],
        ['shadows', -100, 100, 1, 'Sombras', 'Shadows'],
        ['highlights', -100, 100, 1, 'Luces', 'Highlights'],
        ['intensity', 0, 1, 0.05, 'Intensidad', 'Intensity'],
        ['textureStrength', 0, 1, 0.05, 'Textura', 'Texture'],
      ]
        .map(([k, min, max, step, es, en]) =>
          field(
            t(es, en),
            input('filter-' + k, f[k], 'number', `min="${min}" max="${max}" step="${step}"`),
          ),
        )
        .join('')}${field(
        t('Acabado', 'Finish'),
        select(
          'filter-texture',
          ['none', 'grain', 'paper', 'paint', 'ink', 'glow'].map((v) => [v, v]),
          f.texture,
        ),
      )}${field(
        t('Movimiento', 'Motion'),
        select(
          'filter-motion',
          ['none', 'pulse', 'drift', 'paint-fall'].map((v) => [v, v]),
          f.motion,
        ),
      )}${field(t('Color de pintura', 'Paint color'), input('filter-paintColor', f.paintColor, 'color'))}<div class="kit-toolbar">${b(t('Comparar', 'Compare'), 'filter-preview')}${b(t('Aplicar', 'Apply'), 'filter-apply')}${b(t('Guardar mi filtro', 'Save my filter'), 'filter-save')}${b('LUT .cube ↑', 'lut')}${b(t('Quitar filtro', 'Remove filter'), 'filter-reset')}</div></div><div><div class="kit-beforeafter"><figure><canvas id="kit-before"></canvas><figcaption>${t('Antes', 'Before')}</figcaption></figure><figure><canvas id="kit-after"></canvas><figcaption>${t('Después', 'After')}</figcaption></figure></div><div class="kit-list">${state.filters.map((f, i) => `<article>${esc(f.name)}${b(t('Aplicar', 'Apply'), 'saved-filter', i)}${b('JSON ↓', 'filter-export', i)}${b('×', 'filter-remove', i)}</article>`).join('')}</div>${b(t('Importar filtro JSON', 'Import filter JSON'), 'filter-import')}</div></div>`;
    },
    timeline: () =>
      `${field(t('Audio para analizar', 'Audio to analyze'), media('wave-asset', 'audio|video', p()?.audio))}${b(t('Analizar onda y picos', 'Analyze waveform and peaks'), 'wave')}<canvas id="kit-wave" width="900" height="110" aria-label="Audio waveform"></canvas><div class="kit-list">${(
        p()?.audioTracks || []
      )
        .map(
          (tr, i) =>
            `<article><strong>${esc(assets.find((a) => a.id === tr.asset)?.name || tr.asset)}</strong>${[
              ['at', 'Inicio', 'Start', tr.at || 0],
              ['end', 'Final', 'End', tr.end || 0],
              ['volume', 'Volumen', 'Volume', tr.volume ?? 0.7],
            ]
              .map(([k, es, en, v]) =>
                field(t(es, en), input('track-' + k + '-' + i, v, 'number', 'min="0" step="0.1"')),
              )
              .join('')}${b(t('Guardar pista', 'Save track'), 'track-save', i)}</article>`,
        )
        .join(
          '',
        )}</div>${b(t('Abrir mezclador', 'Open mixer'), 'tracks')}<h3>${t('Fotogramas clave', 'Keyframes')}</h3>${field(
        t('Capa', 'Layer'),
        select(
          'key-layer',
          (p()?.layers || []).map((l) => [l.id, l.text || l.kind]),
          selectedLayer,
        ),
      )}<div class="kit-columns">${[
        ['t', 0, 'Segundo', 'Second'],
        ['x', 50, 'X %', 'X %'],
        ['y', 50, 'Y %', 'Y %'],
        ['scale', 1, 'Escala', 'Scale'],
        ['rotation', 0, 'Rotación', 'Rotation'],
        ['opacity', 1, 'Opacidad', 'Opacity'],
      ]
        .map(([k, v, es, en]) => field(t(es, en), input('key-' + k, v, 'number', 'step="0.1"')))
        .join('')}</div>${select(
        'key-easing',
        [
          ['linear', 'Linear'],
          ['ease-in-out', 'Ease in/out'],
          ['hold', 'Hold'],
        ],
        'ease-in-out',
      )}<div class="kit-toolbar">${b(t('Guardar fotograma', 'Save keyframe'), 'key-save')}${b(t('Usar posición actual', 'Use current position'), 'key-current')}${b(t('Quitar fotogramas', 'Clear keyframes'), 'key-clear')}</div><pre id="kit-key-list"></pre>`,
    text: () =>
      `<p>${t('Busca por significado con un modelo multilingüe local. Reordena y selecciona frases para crear un montaje nuevo.', 'Search by meaning with a local multilingual model. Reorder and select sentences to create a new sequence.')}</p><div class="kit-toolbar">${b(t('Transcribir o importar palabras', 'Transcribe or import words'), 'transcript')}${input('semantic-query', '', 'search', `placeholder="${t('Consejos, errores, demostraciones…', 'Tips, mistakes, demonstrations…')}"`)}${b(t('Buscar por significado', 'Search by meaning'), 'semantic')}</div><div id="kit-semantic" class="kit-list"></div>${b(t('Crear montaje de frases marcadas', 'Create sequence from checked sentences'), 'text-montage')}${b(t('Marcar sin muletillas', 'Select without fillers'), 'fillers')}<div id="kit-sentences" class="kit-list"></div>`,
    cutout: () =>
      `${field(t('Foto o vídeo', 'Photo or video'), media('cutout-asset', 'image|video', p()?.asset))}${field(
        t('Fondo del resultado', 'Output background'),
        select(
          'cutout-background',
          [
            ['transparent', t('Transparente · fotos', 'Transparent · photos')],
            ['#0b1310', 'Graphite'],
            ['#ffffff', 'White'],
            ['#00ff00', 'Green'],
          ],
          'transparent',
        ),
      )}<div class="kit-toolbar">${b(t('Quitar fondo de persona', 'Remove person background'), 'cutout')}${b(t('Guardar en Medios', 'Save to Media'), 'cutout-save', '', cutout ? '' : 'disabled')}${b(t('Descargar', 'Download'), 'cutout-download', '', cutout ? '' : 'disabled')}</div><p>${t('Vídeo: hasta 30 s, lado mayor 720, fondo sólido. El resultado informa sobre la conservación del audio.', 'Video: up to 30 s, longest edge 720, solid background. Results report whether audio was preserved.')}</p><div id="kit-cutout-preview"></div><h3>${t('Corregir máscara de foto', 'Refine photo mask')}</h3>${select(
        'brush-mode',
        [
          ['erase', t('Borrar', 'Erase')],
          ['restore', t('Restaurar', 'Restore')],
        ],
        'erase',
      )}${field(t('Pincel', 'Brush'), input('brush-size', 0.035, 'number', 'min="0.005" max="0.2" step="0.005"'))}${b(t('Aplicar pinceladas', 'Apply strokes'), 'brush-apply')}${b(t('Deshacer pincelada', 'Undo stroke'), 'brush-undo')}<canvas id="kit-mask" width="720" height="500" aria-label="Mask correction"></canvas>`,
    review: () =>
      `<div class="kit-toolbar">${b(t('Revisar proyecto', 'Review project'), 'review')}${b(t('Ajustar a zona segura', 'Fit to safe area'), 'safe-fix')}${b(t('Crear cuatro formatos', 'Create four aspect ratios'), 'formats')}${b(t('Paquete social ZIP', 'Social ZIP package'), 'package')}</div>${select(
        'layout',
        [
          ['row', t('Fila', 'Row')],
          ['column', t('Columna', 'Column')],
          ['grid', t('Cuadrícula', 'Grid')],
        ],
        'column',
      )}${b(t('Distribuir capas adaptables', 'Arrange adaptive layers'), 'layout')}<div id="kit-review" class="kit-list"></div>`,
    cloud: () =>
      `<p>${t('Catálogo público separado de los archivos privados. La administración requiere la credencial del propietario en Publicación.', 'Public catalog separated from private files. Administration requires the owner credential in Publishing.')}</p><div class="kit-toolbar">${b(t('Consultar catálogo', 'Check catalog'), 'catalog-status')}${b(t('Publicar catálogo original', 'Publish original catalog'), 'catalog-publish')}${b(t('Configurar servicio', 'Configure service'), 'service')}</div><h3>${t('Revisión por enlace', 'Review by link')}</h3>${field(t('Archivo para revisar', 'File to review'), media('review-asset', 'image|video', p()?.asset))}<p>${t('Crear enlace sube el archivo elegido y el título y descripción del proyecto. Quien tenga el enlace podrá verlo y comentar durante 72 h. Puedes revocarlo.', 'Creating a link uploads the selected file and the project title and caption. Anyone with the link can view and comment for 72 h. You can revoke it.')}</p>${b(t('Crear enlace de revisión', 'Create review link'), 'share')}<div id="kit-share"></div><h3>${t('Diseño generativo local', 'Local generative design')}</h3>${input('generate-prompt', '', 'text', `placeholder="${t('Describe un fondo: pintura oscura…', 'Describe a background: dark paint…')}"`)}${b(t('Crear variación original', 'Create original variation'), 'generate')}<p>${t('Gráficos procedurales por palabras clave. No es un modelo de IA fotográfica.', 'Procedural graphics from keywords. This is not a photographic AI model.')}</p>`,
  };
  function cards() {
    const list =
      category === 'favorites'
        ? L.catalog.filter((i) => state.favorites.includes(i.id))
        : L.search(query, { type: category, limit: 300 });
    modal.querySelector('#kit-cards').innerHTML =
      list
        .slice(page * 24, page * 24 + 24)
        .map(
          (i) =>
            `<article data-resource="${i.id}" draggable="true"><img loading="lazy" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(L.svg(i, { accent: val('accent'), background: val('background'), locale: StudioI18n.locale() }))}" alt="${esc(name(i))}"><div><strong>${esc(name(i))}</strong><small>${esc(i.family || i.type)} · v${esc(i.version)}</small><div>${b(t('Insertar', 'Insert'), 'insert', i.id)}${b(state.favorites.includes(i.id) ? '★' : '☆', 'favorite', i.id)}${['sound', 'transition'].includes(i.type) ? b('▶', 'sound', i.id) : ''}</div><details><summary>${t('Origen y variantes', 'Source and variants')}</summary><p>Fleremahias · Original · ${esc(i.tags.join(', '))}</p>${b(t('Ver relacionados', 'Show related'), 'related', i.id)}</details></div></article>`,
        )
        .join('') || t('No hay resultados.', 'No results.');
    modal.querySelector('#kit-page').textContent =
      `${Math.min(page * 24 + 1, list.length)}–${Math.min(page * 24 + 24, list.length)} / ${list.length}`;
  }
  async function svgAsset(i) {
    const svg = L.svg(i, {
        accent: val('accent') || state.brand.primary,
        background: val('background') || state.brand.background,
        text: p()?.text || name(i),
        locale: StudioI18n.locale(),
      }),
      url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
      image = new Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(Error('SVG decode failed'));
        image.src = url;
      });
      const c = document.createElement('canvas');
      c.width = i.type === 'background' ? 1080 : 720;
      c.height = i.type === 'background' ? 1920 : 720;
      c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
      const png = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
      if (!png) throw Error('PNG export failed');
      return storeAsset(png, name(i) + '.png');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function insert(id) {
    if (busy) return;
    const i = L.get(id);
    if (!i) throw Error('Resource missing');
    if (i.type === 'recipe') {
      recipeId = id;
      tab = 'recipes';
      return paint();
    }
    project();
    if (i.type === 'style') {
      commit((x) => {
        const s = x.scenes.find((s) => s.id === x.activeScene);
        s.filter = 'original';
        s.brightness = 100;
        s.saturation = 100;
        s.adjust = P.scene().adjust;
        s.customFilter = E.normalizeFilter(i.customFilter);
      });
      status(t('Estilo aplicado. Puedes deshacer.', 'Style applied. You can undo.'));
      return;
    }
    if (i.type === 'title') {
      commit((x) => {
        const s = x.scenes.find((s) => s.id === x.activeScene);
        if (s.layers.length >= 40) throw Error('40 layers maximum');
        s.layers.push(
          P.layer({
            ...i.settings,
            kind: 'text',
            text: x.text || state.brand.name,
            color: state.brand.text,
            fill: state.brand.primary,
            autoFit: true,
          }),
        );
        selectedLayer = s.layers.at(-1).id;
      });
      return;
    }
    if (i.type === 'sound' || i.type === 'transition') {
      const transition = i.type === 'transition',
        x = project(),
        index = x.scenes.findIndex((s) => s.id === x.activeScene);
      if (transition && !index)
        throw Error(
          t('Selecciona una escena después de la primera.', 'Select a scene after the first one.'),
        );
      if ((x.audioTracks || []).length >= 12) throw Error('12 audio tracks maximum');
      const sound = L.sound(transition ? i.settings.soundId : i),
        a = await storeAsset(new Blob([sound], { type: 'audio/wav' }), name(i) + '.wav');
      commit((x) => {
        const timing = P.layout(x.scenes),
          at = transition ? timing[index].start : Math.max(0, +previewSeconds || 0);
        if (transition)
          Object.assign(x.scenes[index], {
            transition: i.settings.transition,
            transitionPreset: i.id,
            transitionDuration: i.settings.transitionDuration,
          });
        x.audioTracks ||= [];
        x.audioTracks.push({
          id: crypto.randomUUID(),
          asset: a.id,
          at,
          end: transition ? at + 0.6 : 0,
          sourceStart: 0,
          volume: 0.4,
          muted: false,
          speed: 1,
        });
      });
      status(t('Sonido sincronizado añadido a pistas.', 'Synchronized sound added to tracks.'));
      return;
    }
    const a = await svgAsset(i);
    commit((x) => {
      const s = x.scenes.find((s) => s.id === x.activeScene);
      if (i.type === 'background')
        Object.assign(s, { asset: a.id, start: 0, end: 0, sourceDuration: 0, fit: 'cover' });
      else {
        if (s.layers.length >= 40) throw Error('40 layers maximum');
        s.layers.push(P.layer({ kind: 'image', asset: a.id, x: 50, y: 50, width: 40, height: 25 }));
        selectedLayer = s.layers.at(-1).id;
      }
    });
    status(t('Recurso añadido.', 'Resource added.'));
  }
  function readFilter() {
    const obj = { ...p()?.customFilter };
    for (const k of [
      'name',
      'exposure',
      'contrast',
      'saturation',
      'temperature',
      'gamma',
      'shadows',
      'highlights',
      'intensity',
      'textureStrength',
      'texture',
      'motion',
      'paintColor',
    ])
      obj[k] = val('filter-' + k);
    return E.normalizeFilter(obj);
  }
  function filterPreview() {
    if (!p()) return;
    const before = modal.querySelector('#kit-before'),
      after = modal.querySelector('#kit-after');
    if (!before) return;
    for (const c of [before, after]) [c.width, c.height] = C.dimensions(p().format, 360);
    const media = previewMedia?.readyState >= 2 ? previewMedia : imageObj,
      s = structuredClone(p());
    s.customFilter = null;
    LumaCompositor.paint(before.getContext('2d'), s, media, previewSeconds || 0, assetImages);
    s.customFilter = readFilter();
    LumaCompositor.paint(after.getContext('2d'), s, media, previewSeconds || 0, assetImages);
  }
  function textRows() {
    groups = K.sentences(p()?.transcript || []);
    if (!order.length || order.some((id) => !groups.some((g) => g.id === id)))
      order = groups.map((g) => g.id);
    modal.querySelector('#kit-sentences').innerHTML =
      order
        .map((id, index) => {
          const g = groups.find((g) => g.id === id);
          return `<article><label><input type="checkbox" data-sentence="${id}" checked>${g.start.toFixed(1)}–${g.end.toFixed(1)} s</label><textarea data-sentence-text="${id}">${esc(g.text)}</textarea>${b('↑', 'sentence-up', index)}${b('↓', 'sentence-down', index)}</article>`;
        })
        .join('') || t('Transcribe primero.', 'Transcribe first.');
  }
  function wordScene(x, g) {
    if (!assets.some((a) => a.id === x.transcriptAsset))
      throw Error(t('Falta el archivo de la transcripción.', 'Transcript media is missing.'));
    const s = P.scene({
      asset: x.transcriptAsset,
      start: g.start,
      end: g.end,
      sourceDuration: x.transcript.at(-1).end,
      transition: 'cut',
      text: '',
      subtitleStyle: 'karaoke',
    });
    s.words = g.words.map((w) => ({ ...w, start: w.start - g.start, end: w.end - g.start }));
    s.subtitles = LumaFlowCore.wordsToSrt(s.words);
    return s;
  }
  function drawWave() {
    const c = modal.querySelector('#kit-wave');
    if (!c) return;
    const ctx = c.getContext('2d'),
      wave = waves.get(val('wave-asset'))?.wave || [];
    ctx.fillStyle = '#0b161c';
    ctx.fillRect(0, 0, c.width, c.height);
    wave.forEach((v, i) => {
      ctx.fillStyle = v.peak >= 0.999 ? '#ff8383' : '#92e7c9';
      const h = Math.max(1, v.peak * c.height);
      ctx.fillRect(
        (i * c.width) / wave.length,
        (c.height - h) / 2,
        Math.max(1, c.width / wave.length - 1),
        h,
      );
    });
  }
  function showKeys() {
    const l = p()?.layers?.find((l) => l.id === val('key-layer'));
    modal.querySelector('#kit-key-list').textContent = JSON.stringify(l?.keyframes || [], null, 2);
  }
  function showCutout() {
    if (!cutout) return;
    const el = modal.querySelector('#kit-cutout-preview');
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(cutout.blob);
    el.innerHTML = cutout.blob.type.startsWith('video')
      ? `<video controls src="${previewURL}"></video>`
      : `<img src="${previewURL}" alt="Cutout">`;
    if (cutout.blob.type.startsWith('image')) {
      const canvas = modal.querySelector('#kit-mask'),
        image = new Image();
      image.onload = () => {
        canvas.width = Math.min(720, image.width);
        canvas.height = Math.round((canvas.width * image.height) / image.width);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      };
      image.src = previewURL;
      let stroke = null;
      canvas.onpointerdown = (e) => {
        const r = canvas.getBoundingClientRect();
        stroke = {
          mode: val('brush-mode'),
          radius: +val('brush-size') || 0.035,
          points: [{ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }],
        };
        brushes.push(stroke);
        canvas.setPointerCapture(e.pointerId);
      };
      canvas.onpointermove = (e) => {
        if (!stroke) return;
        const r = canvas.getBoundingClientRect(),
          pt = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
        stroke.points.push(pt);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = stroke.mode === 'erase' ? '#ff668855' : '#6fffb455';
        ctx.beginPath();
        ctx.arc(
          pt.x * canvas.width,
          pt.y * canvas.height,
          stroke.radius * canvas.width,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      };
      canvas.onpointerup = () => (stroke = null);
    }
  }
  async function file(accept, fn, multiple = false) {
    const el = document.createElement('input');
    el.type = 'file';
    el.accept = accept;
    el.multiple = multiple;
    el.onchange = async () => {
      try {
        await fn(multiple ? [...el.files] : el.files[0]);
      } catch (e) {
        status(e.message);
      }
    };
    el.click();
  }
  async function click(event) {
    const el = event.target.closest('[data-kit]');
    if (!el) return;
    const action = el.dataset.kit,
      v = el.dataset.value;
    try {
      if (busy && action !== 'cancel')
        return status(
          t('Espera o cancela el proceso activo.', 'Wait or cancel the active process.'),
        );
      if (action === 'cancel') {
        abort?.abort();
        abortExport = true;
        return;
      }
      if (action === 'close') return close();
      if (action === 'help') return root.FleremahiasHelp?.open?.('creative-library');
      if (action === 'tab') {
        tab = v;
        return paint();
      }
      if (action === 'search') {
        query = val('search');
        page = 0;
        cards();
      }
      if (action === 'page') {
        page = Math.max(0, Math.min(10, page + +v));
        cards();
      }
      if (action === 'favorite') {
        state.favorites = state.favorites.includes(v)
          ? state.favorites.filter((id) => id !== v)
          : [...state.favorites, v];
        persist();
        cards();
      }
      if (action === 'related') {
        const i = L.get(v);
        query = i.tags[0] || '';
        category = i.type;
        page = 0;
        paint();
      }
      if (action === 'insert') await insert(v);
      if (action === 'sound') {
        soundPreview?.pause();
        const i = L.get(v),
          url = URL.createObjectURL(
            new Blob([L.sound(i.type === 'transition' ? i.settings.soundId : i)], {
              type: 'audio/wav',
            }),
          );
        soundPreview = new Audio(url);
        soundPreview.onended = () => URL.revokeObjectURL(url);
        await soundPreview.play();
      }
      if (action === 'import-media')
        await file(
          'image/*,video/*,audio/*',
          async (files) => {
            for (const f of files) {
              if (f.size > 180 * 1024 * 1024) throw Error('Maximum 180 MB');
              await storeAsset(f, f.name);
            }
            paint();
            status(t('Archivos importados.', 'Files imported.'));
          },
          true,
        );
      if (action.startsWith('brand-')) {
        state.brand = K.brand({
          name: val('brand-name'),
          primary: val('brand-primary'),
          background: val('brand-background'),
          text: val('brand-text'),
          font: val('brand-font'),
          logo: val('brand-logo'),
          closing: val('brand-closing'),
        });
        persist();
        if (action === 'brand-apply')
          commit((x) => {
            for (const s of x.scenes) {
              s.bg = state.brand.background;
              s.color = state.brand.text;
              s.font = state.brand.font;
              for (const l of s.layers)
                if (l.kind === 'text') {
                  l.color = state.brand.text;
                  l.fill = state.brand.primary;
                  l.font = state.brand.font;
                  l.autoFit = true;
                }
              if (
                state.brand.logo &&
                s.layers.length < 40 &&
                !s.layers.some((l) => l.group === 'brand-logo')
              )
                s.layers.push(
                  P.layer({
                    kind: 'image',
                    asset: state.brand.logo,
                    x: 18,
                    y: 15,
                    width: 18,
                    height: 10,
                    group: 'brand-logo',
                  }),
                );
            }
          });
        if (action === 'brand-outro')
          commit((x) => {
            if (x.scenes.length >= 24) throw Error('24 scenes maximum');
            const s = P.scene({
              duration: 3,
              text: state.brand.closing || state.brand.name,
              bg: state.brand.background,
              color: state.brand.text,
              font: state.brand.font,
            });
            if (state.brand.logo)
              s.layers.push(
                P.layer({
                  kind: 'image',
                  asset: state.brand.logo,
                  x: 50,
                  y: 30,
                  width: 30,
                  height: 20,
                }),
              );
            x.scenes.push(s);
            x.activeScene = s.id;
          });
        status(t('Identidad guardada.', 'Brand saved.'));
      }
      if (action === 'recipe-save') {
        const x = project();
        P.mirror(x);
        if (state.recipes.length >= 24) throw Error('24 recipes maximum');
        state.recipes.push(K.recipe(x, val('recipe-name')));
        persist();
        paint();
      }
      if (action === 'recipe-apply') {
        commit((x) =>
          K.applyRecipe(
            x,
            state.recipes.find((r) => r.id === v),
            P.scene,
            P.layer,
          ),
        );
        status(t('Receta aplicada.', 'Recipe applied.'));
      }
      if (action === 'recipe-export')
        download(
          new Blob(
            [
              JSON.stringify(
                state.recipes.find((r) => r.id === v),
                null,
                2,
              ),
            ],
            { type: 'application/json' },
          ),
          'Fleremahias-recipe.json',
        );
      if (action === 'recipe-remove') {
        state.recipes = state.recipes.filter((r) => r.id !== v);
        persist();
        paint();
      }
      if (action === 'recipe-import')
        await file('.json', async (f) => {
          if (f.size > 3000000) throw Error('Maximum 3 MB');
          state.recipes.push(K.normalizeRecipe(JSON.parse(await f.text())));
          state.recipes = state.recipes.slice(-24);
          persist();
          paint();
        });
      if (action === 'build') await buildRecipe();
      if (action === 'filter-preview') filterPreview();
      if (action === 'filter-apply')
        commit((x) => (x.scenes.find((s) => s.id === x.activeScene).customFilter = readFilter()));
      if (action === 'filter-save') {
        if (state.filters.length >= 40) throw Error('40 filters maximum');
        state.filters.push(readFilter());
        persist();
        paint();
      }
      if (action === 'filter-reset') {
        commit((x) => (x.scenes.find((s) => s.id === x.activeScene).customFilter = null));
        paint();
      }
      if (action === 'saved-filter') {
        commit(
          (x) =>
            (x.scenes.find((s) => s.id === x.activeScene).customFilter = E.normalizeFilter(
              state.filters[+v],
            )),
        );
        status(t('Filtro aplicado.', 'Filter applied.'));
      }
      if (action === 'filter-export')
        download(
          new Blob(
            [
              JSON.stringify({
                studio: 'Fleremahias Filter',
                version: 1,
                filter: state.filters[+v],
              }),
            ],
            { type: 'application/json' },
          ),
          'Fleremahias-filter.json',
        );
      if (action === 'filter-remove') {
        state.filters.splice(+v, 1);
        persist();
        paint();
      }
      if (action === 'filter-import')
        await file('.json', async (f) => {
          if (f.size > 3000000) throw Error('Maximum 3 MB');
          const data = JSON.parse(await f.text());
          if (data.studio !== 'Fleremahias Filter') throw Error('Invalid filter');
          state.filters.push(E.normalizeFilter(data.filter));
          state.filters = state.filters.slice(-40);
          persist();
          paint();
        });
      if (action === 'lut')
        await file('.cube', async (f) => {
          if (f.size > 5000000) throw Error('Maximum 5 MB');
          const lut = E.parseCube(await f.text());
          commit(
            (x) =>
              (x.scenes.find((s) => s.id === x.activeScene).customFilter = E.normalizeFilter({
                ...readFilter(),
                lut,
              })),
          );
          paint();
          status('LUT ' + lut.size + '³');
        });
      if (action === 'wave')
        await job(async () => {
          const a = assets.find((a) => a.id === val('wave-asset'));
          if (!a) throw Error(t('Selecciona audio.', 'Select audio.'));
          status(t('Analizando audio…', 'Analyzing audio…'));
          const buf = await LumaFlowMedia.decode(a),
            wave = K.waveform(buf.getChannelData(0), 180);
          waves.set(a.id, { wave, duration: buf.duration, peaks: wave.map((b) => b.peak) });
          drawWave();
          status(
            wave.some((b) => b.peak >= 0.999)
              ? t('Hay picos próximos a saturación.', 'Some peaks are close to clipping.')
              : t('Onda analizada.', 'Waveform analyzed.'),
          );
        });
      if (action === 'tracks') {
        close();
        LumaFlow.open('tracks');
      }
      if (action === 'track-save')
        commit((x) => {
          const tr = x.audioTracks[+v];
          let at = Math.max(0, Math.min(120, +val('track-at-' + v) || 0)),
            end = Math.max(0, Math.min(120, +val('track-end-' + v) || 0));
          for (const point of P.layout(x.scenes).map((s) => s.start))
            if (Math.abs(point - at) < 0.12) at = point;
          if (end && end <= at)
            throw Error(t('El final debe ser posterior al inicio.', 'End must be after start.'));
          tr.at = at;
          tr.end = end;
          tr.volume = Math.max(0, Math.min(1, +val('track-volume-' + v) || 0));
        });
      if (action === 'key-current') {
        const l = project().layers.find((l) => l.id === val('key-layer'));
        if (!l) throw Error('Select a layer');
        for (const k of ['x', 'y', 'scale', 'rotation', 'opacity'])
          modal.querySelector('#kit-key-' + k).value = l[k] ?? (k === 'scale' ? 1 : 0);
        modal.querySelector('#kit-key-t').value = previewSeconds || 0;
      }
      if (action === 'key-save') {
        commit((x) => {
          const l = x.scenes
            .find((s) => s.id === x.activeScene)
            .layers.find((l) => l.id === val('key-layer'));
          if (!l) throw Error(t('Selecciona una capa.', 'Select a layer.'));
          const key = Object.fromEntries(
            ['t', 'x', 'y', 'scale', 'rotation', 'opacity'].map((k) => [k, +val('key-' + k)]),
          );
          if (key.t > P.length(x))
            throw Error(t('El tiempo supera la duración.', 'Time exceeds duration.'));
          key.easing = val('key-easing');
          l.keyframes = E.normalizeKeyframes([
            ...(l.keyframes || []).filter((k) => k.t !== key.t),
            key,
          ]);
        });
        showKeys();
      }
      if (action === 'key-clear') {
        commit((x) => {
          const l = x.scenes
            .find((s) => s.id === x.activeScene)
            .layers.find((l) => l.id === val('key-layer'));
          if (l) l.keyframes = [];
        });
        showKeys();
      }
      if (action === 'transcript') {
        close();
        LumaFlow.open('text');
      }
      if (action === 'semantic')
        await job(async (signal) => {
          const x = project();
          if (!x.transcript?.length) throw Error(t('Transcribe primero.', 'Transcribe first.'));
          const result = await FleremahiasSmartMedia.search(x.transcript, val('semantic-query'), {
            signal,
            onProgress: status,
            limit: 8,
          });
          semantic = result.segments;
          modal.querySelector('#kit-semantic').innerHTML = semantic
            .map(
              (g, i) =>
                `<article><strong>${g.start.toFixed(1)}–${g.end.toFixed(1)} s</strong><p>${esc(g.text)}</p><small>${t('Similitud', 'Similarity')}: ${Math.round(g.score * 100)}%</small>${b(t('Crear clip', 'Create clip'), 'semantic-clip', i)}</article>`,
            )
            .join('');
          status(
            t(
              'Resultados por significado; revisa el contexto.',
              'Meaning-based results; review context.',
            ),
          );
        });
      if (action === 'semantic-clip') {
        const x = project(),
          g = semantic[+v],
          words = x.transcript.filter((w) => w.end > g.start && w.start < g.end);
        make([wordScene(x, { ...g, words })], x.name + ' · ' + g.text.slice(0, 35), x.format);
        close();
      }
      if (action === 'sentence-up' || action === 'sentence-down') {
        const i = +v,
          next = i + (action === 'sentence-up' ? -1 : 1);
        if (next >= 0 && next < order.length) [order[i], order[next]] = [order[next], order[i]];
        textRows();
      }
      if (action === 'fillers')
        modal.querySelectorAll('[data-sentence]').forEach((el) => {
          const g = groups.find((g) => g.id === +el.dataset.sentence);
          el.checked = !/\b(eh|em|mmm|um|uh|you know)\b/i.test(g.text);
        });
      if (action === 'text-montage') {
        const x = project(),
          ids = [...modal.querySelectorAll('[data-sentence]:checked')].map(
            (el) => +el.dataset.sentence,
          ),
          scenes = K.reorder(groups, ids).map((g) => {
            const s = wordScene(x, g);
            s.subtitles = LumaProCore.timedCaptions(
              modal.querySelector(`[data-sentence-text="${g.id}"]`).value,
              P.length(s),
              5,
            );
            s.words = [];
            return s;
          });
        make(scenes, x.name + ' · ' + t('edición por texto', 'text edit'), x.format, x.caption);
        close();
      }
      if (action === 'cutout')
        await job(async (signal) => {
          const a = assets.find((a) => a.id === val('cutout-asset'));
          if (!a) throw Error('Select media');
          brushes = [];
          const result = await FleremahiasSmartMedia.removeBackground(a.blob, {
            background: val('cutout-background'),
            signal,
            onProgress: status,
          });
          cutout = { ...result, original: a.blob, background: val('cutout-background') };
          showCutout();
          for (const a of ['cutout-save', 'cutout-download'])
            modal.querySelector(`[data-kit=${a}]`).disabled = false;
          status(
            (result.warnings || []).join(' · ') || t('Recorte terminado.', 'Cutout complete.'),
          );
        });
      if (action === 'cutout-save' && cutout) {
        await storeAsset(
          cutout.blob,
          'Fleremahias-cutout.' + (cutout.blob.type.startsWith('video') ? 'webm' : 'png'),
        );
        status(t('Recorte guardado.', 'Cutout saved.'));
      }
      if (action === 'cutout-download' && cutout)
        download(
          cutout.blob,
          'Fleremahias-cutout.' + (cutout.blob.type.startsWith('video') ? 'webm' : 'png'),
        );
      if (action === 'brush-undo') {
        brushes.pop();
        showCutout();
      }
      if (action === 'brush-apply') {
        if (!cutout?.mask)
          throw Error(t('Recorta primero una foto.', 'Remove a photo background first.'));
        const result = await FleremahiasSmartMedia.refineImage(cutout.original, cutout.mask, {
          background: cutout.background,
          brushes,
        });
        cutout = { ...cutout, ...result };
        showCutout();
      }
      if (action === 'review') runReview();
      if (action === 'safe-fix') {
        commit(
          (x) =>
            (x.scenes = E.adaptProject(x, x.format, {
              platform: x.platform === 'TikTok' ? 'tiktok' : 'reels',
            }).scenes),
        );
        runReview();
      }
      if (action === 'layout') {
        commit((x) => {
          const s = x.scenes.find((s) => s.id === x.activeScene);
          s.layers = E.layoutLayers(s.layers, { direction: val('layout'), margin: 10, gap: 4 });
        });
        status(t('Capas adaptables distribuidas.', 'Adaptive layers arranged.'));
      }
      if (action === 'formats') {
        const x = project();
        P.mirror(x);
        for (const f of ['9:16', '1:1', '4:5', '16:9']) {
          const copy = E.adaptProject(x, f, { platform: f === '9:16' ? 'reels' : 'generic' });
          copy.id = crypto.randomUUID();
          copy.created = Date.now();
          copy.scenes = copy.scenes.map(P.scene);
          copy.activeScene = copy.scenes[0].id;
          P.activate(copy, copy.activeScene, false);
          projects.unshift(copy);
        }
        save();
        status(t('Cuatro copias creadas en Mis proyectos.', 'Four copies created in My projects.'));
      }
      if (action === 'package') await socialPackage();
      if (action === 'service') {
        close();
        LumaFlow.open('publish');
      }
      if (action === 'catalog-status') {
        const response = await fetch(service() + '/catalog/v1/resources?limit=1', {
            signal: AbortSignal.timeout(15000),
          }),
          data = await response.json();
        if (!response.ok) throw Error(data.error || 'Catalog unavailable');
        status(
          t('Catálogo conectado: ', 'Catalog connected: ') +
            (data.total ?? data.items?.length ?? 0),
        );
      }
      if (action === 'catalog-publish')
        await job(async (signal) => {
          const data = await ownerRequest('/catalog/admin/catalog', {
            method: 'POST',
            body: JSON.stringify({ items: L.catalog }),
            signal,
          });
          status(t('Catálogo publicado.', 'Catalog published.'));
        });
      if (action === 'share') await createShare();
      if (action === 'revoke') {
        await ownerRequest('/review/v1/share/' + v, { method: 'DELETE' });
        modal.querySelector('#kit-share').textContent = t('Enlace revocado.', 'Link revoked.');
      }
      if (action === 'generate') {
        const matches = L.search(val('generate-prompt'), { type: 'background', limit: 60 }),
          i = matches[Math.floor(Math.random() * matches.length)];
        if (!i) throw Error(t('Prueba con pintura, papel o neón.', 'Try paint, paper or neon.'));
        const a = await svgAsset(i);
        status(t('Variación guardada: ', 'Variation saved: ') + a.name);
      }
    } catch (e) {
      status(e.message);
    }
  }
  function service() {
    return 'https://fleremahias-studio.analista-datos-pro.workers.dev';
  }
  async function ownerRequest(path, options = {}) {
    if (!root.LumaFlowToken)
      throw Error(
        t(
          'Configura la credencial del propietario en Publicación.',
          'Configure the owner credential in Publishing.',
        ),
      );
    const response = await fetch(service() + path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + root.LumaFlowToken,
          ...options.headers,
        },
        signal: options.signal || AbortSignal.timeout(30000),
      }),
      data = await response.json();
    if (!response.ok) throw Error(data.error || 'Service error');
    return data;
  }
  function runReview() {
    const x = project();
    P.mirror(x);
    const issues = E.review(x, {
        assetIds: assets.map((a) => a.id),
        audioPeaks: [...waves.values()].flatMap((v) => v.peaks),
        platform: x.platform === 'TikTok' ? 'tiktok' : 'reels',
      }),
      base = LumaProCore.audit(x, assets);
    modal.querySelector('#kit-review').innerHTML =
      [
        ...issues.map((i) => ({
          message: `${i.scene || ''} · ${i.message}`,
          severity: i.severity,
        })),
        ...base.errors.map((message) => ({ message, severity: 'error' })),
        ...base.warnings.map((message) => ({ message, severity: 'warning' })),
      ]
        .map((i) => `<article class="${i.severity}">${esc(i.message)}</article>`)
        .join('') ||
      t(
        'No se detectaron problemas automáticos. Revisa el vídeo final.',
        'No automated issues found. Review the final video.',
      );
  }
  async function buildRecipe() {
    const i = L.get(val('recipe')),
      r = i.recipe,
      hook = val('hook'),
      cta = val('cta'),
      lines = val('lines')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      chosen = [...modal.querySelectorAll('[data-pick]:checked')]
        .map((el) => assets.find((a) => a.id === el.dataset.pick))
        .filter(Boolean);
    if (['audiogram', 'data-3d'].includes(r.objective)) {
      const audioAsset = chosen.find((a) => a.type.startsWith('audio'))?.id;
      if (r.objective === 'audiogram' && !audioAsset)
        throw Error(t('Selecciona un archivo de audio.', 'Select an audio file.'));
      const values = lines
        .map((v) => Number(v.split(':').at(-1)))
        .filter(Number.isFinite)
        .slice(0, 8);
      if (r.objective === 'data-3d' && !values.length)
        throw Error(t('Introduce al menos una cifra.', 'Enter at least one figure.'));
      close();
      FleremahiasMotion.openWith({
        preset: r.objective === 'audiogram' ? 'audiogram' : 'data3d',
        audioAsset,
        values,
        title: hook || state.brand.name,
        subtitle: cta,
        accent: state.brand.primary,
        background: state.brand.background,
      });
      return;
    }
    if (r.objective === 'podcast') {
      close();
      open('text');
      return;
    }
    const visual = chosen.filter((a) => /^(image|video)/.test(a.type));
    if (!visual.length && r.objective !== 'brand-outro')
      throw Error(t('Selecciona una foto o vídeo.', 'Select a photo or video.'));
    if (r.objective === 'before-after' && visual.length < 2)
      throw Error(
        t('Selecciona dos archivos: antes y después.', 'Select two files: before and after.'),
      );
    let texts = ['tutorial', 'list'].includes(r.objective)
      ? lines
      : r.objective === 'product'
        ? [hook, cta]
        : r.objective === 'brand-outro'
          ? [state.brand.closing || state.brand.name]
          : visual.map((_, n) => (n === 0 ? hook : cta));
    if (!texts.length) throw Error(t('Añade los pasos o textos.', 'Add steps or text.'));
    const scenes = [];
    for (let n = 0; n < texts.length; n++) {
      const a = visual[n % Math.max(1, visual.length)];
      let end = 0,
        sourceDuration = 0;
      if (a?.type.startsWith('video')) {
        const video = await LumaFlowMedia.video(a);
        sourceDuration = video.duration;
        end = Math.min(4, video.duration);
        video.removeAttribute('src');
        video.load();
      }
      scenes.push(
        P.scene({
          customFilter: L.get(r.styleId)?.customFilter,
          asset: a?.id || null,
          text: texts[n],
          duration: 4,
          end,
          sourceDuration,
          motion: a?.type.startsWith('image') ? 'zoom-in' : 'none',
          color: state.brand.text,
          bg: state.brand.background,
          font: state.brand.font,
          transition: 'fade',
        }),
      );
    }
    make(scenes, (hook || name(i)).slice(0, 80), val('format'), cta);
    close();
  }
  async function socialPackage() {
    await job(async (signal) => {
      const x = project();
      P.mirror(x);
      status(t('Renderizando paquete…', 'Rendering package…'));
      const result = await runSequence(x, { download: false });
      if (signal.aborted) return;
      if (!result?.blob) throw Error('Video export failed');
      const canvas = $('#canvas'),
        png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png')),
        words = [];
      let start = 0;
      for (const s of x.scenes) {
        for (const c of C.parseSRT(s.subtitles || ''))
          words.push({ text: c.text, start: start + c.start, end: start + c.end });
        start += P.length(s);
      }
      const files = [
        { name: result.name || 'video.webm', data: result.blob },
        { name: 'cover.png', data: png },
        {
          name: 'captions.srt',
          data: new Blob([LumaFlowCore.wordsToSrt(words)], { type: 'text/plain' }),
        },
        { name: 'caption.txt', data: new Blob([x.caption || ''], { type: 'text/plain' }) },
        {
          name: 'manifest.json',
          data: new Blob([JSON.stringify(K.manifest(x), null, 2)], { type: 'application/json' }),
        },
      ];
      const zip = await P.zip(files);
      if (!signal.aborted) download(zip, 'Fleremahias-social-package.zip');
      status(
        t(
          'Paquete listo: vídeo, portada, SRT y descripción.',
          'Package ready: video, cover, SRT and caption.',
        ),
      );
    });
  }
  async function createShare() {
    await job(async (signal) => {
      const x = project(),
        asset = assets.find((a) => a.id === val('review-asset'));
      if (!asset) throw Error('Select a review file');
      if (asset.blob.size > 20 * 1024 * 1024) throw Error('Maximum 20 MB');
      status(t('Subiendo archivo para revisión…', 'Uploading review file…'));
      const upload = await ownerRequest('/review/v1/upload/' + crypto.randomUUID(), {
          method: 'PUT',
          headers: { 'Content-Type': asset.type },
          body: asset.blob,
          signal,
        }),
        data = await ownerRequest('/review/v1/create', {
          method: 'POST',
          signal,
          body: JSON.stringify({
            title: x.name,
            caption: x.caption,
            project: {
              name: x.name,
              format: x.format,
              sceneCount: x.scenes.length,
              duration: P.layout(x.scenes).at(-1).end,
            },
            assetKeys: [upload.key],
            expiresHours: 72,
          }),
        }),
        url = service() + '/review.html#' + encodeURIComponent(data.token);
      modal.querySelector('#kit-share').innerHTML =
        `<a href="${url}" target="_blank" rel="noopener">${esc(url)}</a>${b(t('Revocar enlace', 'Revoke link'), 'revoke', data.token)}`;
      status(t('Enlace de 72 horas creado.', '72-hour review link created.'));
    });
  }
  const backupBase = makeBackup;
  makeBackup = async function (list) {
    const backup = await backupBase(list);
    backup.creativeKit = structuredClone(state);
    if (state.brand.logo && !backup.media.some((m) => m.id === state.brand.logo)) {
      const a = assets.find((a) => a.id === state.brand.logo);
      if (a)
        backup.media.push({ id: a.id, name: a.name, type: a.type, data: await dataURL(a.blob) });
    }
    return backup;
  };
  const restoreBase = restoreCreatorBackup;
  restoreCreatorBackup = function (backup, restored, ids) {
    restoreBase(backup, restored, ids);
    if (!backup.creativeKit) return;
    const s = backup.creativeKit;
    state.brand = K.brand(s.brand);
    state.brand.logo = ids.get(state.brand.logo) || null;
    state.recipes = (s.recipes || []).slice(0, 24).map(K.normalizeRecipe);
    state.filters = (s.filters || []).slice(0, 40).map(E.normalizeFilter);
    state.favorites = (s.favorites || []).filter((id) => L.get(id)).slice(0, 300);
    persist();
  };
  const launch = document.createElement('button');
  launch.className = 'kit-launch';
  launch.textContent = '✦ ' + t('Biblioteca original', 'Original library');
  launch.onclick = () => open();
  document.querySelector('aside nav')?.append(launch);
  const renderBase = renderEditor;
  renderEditor = function () {
    renderBase();
    if (!document.querySelector('#kit-editor-open')) {
      const button = document.createElement('button');
      button.id = 'kit-editor-open';
      button.textContent = '✦ ' + t('Biblioteca y recetas', 'Library and recipes');
      button.onclick = () => open();
      document.querySelector('main > .actions')?.prepend(button);
    }
  };
  document.addEventListener('dragover', (e) => {
    if (
      e.target.closest('#canvas,#sceneTrack') &&
      e.dataTransfer.types.includes('application/x-fleremahias-resource')
    )
      e.preventDefault();
  });
  document.addEventListener('drop', async (e) => {
    const id = e.dataTransfer?.getData('application/x-fleremahias-resource');
    if (id && e.target.closest('#canvas,#sceneTrack')) {
      e.preventDefault();
      try {
        await insert(id);
      } catch (error) {
        toast(error.message);
      }
    }
  });
  root.FleremahiasCreative = { open, close };
})(window);
