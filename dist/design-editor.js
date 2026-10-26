(function (root) {
  'use strict';
  const D = root.FleremahiasDesignCore,
    key = 'fleremahias-blocks-v1';
  let dialog,
    tab = 'layout',
    selection = new Set(),
    styleClipboard = null,
    blocks = [];
  try {
    blocks = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(blocks)) blocks = [];
    blocks = blocks
      .slice(0, 12)
      .filter((b) => b && typeof b.name === 'string' && Array.isArray(b.layers))
      .map((b) => ({
        id: String(b.id).slice(0, 100),
        name: b.name.slice(0, 70),
        layers: b.layers.slice(0, 40).map(P.layer),
      }));
  } catch {
    blocks = [];
  }
  const button = (name, action, description, extra = '') =>
    `<button type="button" data-design="${action}" data-help-chapter="design-pro" data-help-description="${esc(description)}" ${extra}>${name}</button>`;
  function requireProject() {
    if (!p()) throw Error('Abre un proyecto para componer.');
    if (rendering || batchBusy || labBusy)
      throw Error('Termina el proceso actual antes de editar.');
    return P.ensure(p());
  }
  function persistBlocks() {
    localStorage.setItem(key, JSON.stringify(blocks));
  }
  function metrics() {
    const c = document.querySelector('#canvas');
    if (!c) return {};
    return Object.fromEntries(
      hitBoxes
        .filter((b) => b.id !== 'base')
        .map((b) => [b.id, { w: (b.w / c.width) * 100, h: (b.h / c.height) * 100 }]),
    );
  }
  function commit(fn) {
    const x = requireProject();
    P.mirror(x);
    const before = JSON.stringify(x);
    try {
      fn(x);
      clearTimeout(historyTimer);
      if (history.at(-1) !== before) history.push(before);
      if (history.length > 40) history.shift();
      future = [];
      save();
      remember();
      renderTimeline();
      renderTool();
      renderLayerInspector();
      draw();
      paint();
    } catch (e) {
      Object.assign(x, JSON.parse(before));
      throw e;
    }
  }
  function open() {
    let x;
    try {
      x = requireProject();
    } catch (e) {
      return toast(e.message);
    }
    root.LumaFlow.close();
    root.LumaPro.close();
    selection = new Set(
      selectedLayer !== 'base'
        ? [selectedLayer]
        : x.layers.filter((l) => !l.locked && !l.hidden).map((l) => l.id),
    );
    tab = 'layout';
    dialog?.remove();
    dialog = document.createElement('dialog');
    dialog.className = 'design-dialog';
    dialog.setAttribute('aria-label', 'Composición Pro');
    dialog.innerHTML = `<div class="design-header"><div><small>FLEREMAHIAS · DISEÑO DE CONTENIDO</small><h2>Composición Pro.</h2><p>Alinea, reutiliza y adapta tus piezas.</p></div><button type="button" data-help-launch="context" aria-label="Ayuda de composición">? Ayuda</button>${button('Volver al editor', 'close', 'Cierra este panel y vuelve al montaje.')}</div><nav class="design-tabs">${[
      ['layout', 'Componer'],
      ['reuse', 'Estilos y bloques'],
      ['formats', 'Adaptar formatos'],
    ]
      .map(([id, n]) =>
        button(
          n,
          'tab',
          'Muestra las herramientas de ' + n.toLowerCase() + '.',
          `data-value="${id}"`,
        ),
      )
      .join(
        '',
      )}</nav><div class="design-workspace"><section class="design-selection"><h3>Capas de la escena</h3><p>Las operaciones respetan capas bloqueadas u ocultas.</p>${button('Seleccionar editables', 'select-all', 'Marca las capas visibles y desbloqueadas de la escena.')}<div id="design-layer-list"></div><small id="design-count"></small></section><section id="design-content"></section><section class="design-preview"><small>ESCENA ACTUAL</small><canvas id="design-preview"></canvas><p>Los cambios se guardan en el proyecto y se incluyen al exportar.</p>${button('↶ Deshacer', 'undo', 'Deshace el último cambio del proyecto.')}</section></div><footer><span role="status" id="design-feedback">Selecciona capas o consulta Adaptar formatos.</span><small>Las capas giradas y los textos largos requieren revisión visual.</small></footer>`;
    dialog.onclick = dispatch;
    dialog.oncancel = (e) => {
      e.preventDefault();
      dialog.close();
    };
    document.body.append(dialog);
    dialog.showModal();
    paint();
    const opened = dialog;
    let frame,
      last = 0;
    function tick(now) {
      if (dialog !== opened || !opened.open) return;
      if (now - last > 240) {
        preview();
        last = now;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    opened.addEventListener('close', () => cancelAnimationFrame(frame), { once: true });
  }
  function paint() {
    if (!dialog?.open || !p()) return;
    const inputs = Object.fromEntries(
      [
        ...dialog.querySelectorAll(
          '#design-relative,#design-gap,#design-columns,#design-block-name',
        ),
      ].map((el) => [el.id, el.value]),
    );
    const x = p();
    selection = new Set([...selection].filter((id) => x.layers.some((l) => l.id === id)));
    dialog
      .querySelectorAll('[data-design="tab"]')
      .forEach((b) => b.classList.toggle('active', b.dataset.value === tab));
    dialog.querySelector('#design-layer-list').innerHTML =
      x.layers
        .map(
          (l) =>
            `<label><input type="checkbox" data-design-layer="${esc(l.id)}" ${selection.has(l.id) ? 'checked' : ''}><span>${esc(l.kind)} · ${esc((l.text || assets.find((a) => a.id === l.asset)?.name || 'Elemento').slice(0, 50))}</span><small>${l.locked ? '🔒' : l.hidden ? 'Oculta' : ''}</small></label>`,
        )
        .join('') ||
      '<p>Añade textos, formas o medios como capas desde el editor para componerlos.</p>';
    dialog.querySelectorAll('[data-design-layer]').forEach(
      (el) =>
        (el.onchange = () => {
          el.checked
            ? selection.add(el.dataset.designLayer)
            : selection.delete(el.dataset.designLayer);
          count();
        }),
    );
    count();
    let html = '';
    if (tab === 'layout')
      html = `<h3>Alineación precisa.</h3><label>Referencia<select id="design-relative"><option value="canvas">Lienzo · margen 6%</option><option value="selection">Extremos de la selección</option></select></label><div class="design-grid">${[
        ['left', 'Izquierda'],
        ['center', 'Centro horizontal'],
        ['right', 'Derecha'],
        ['top', 'Arriba'],
        ['middle', 'Centro vertical'],
        ['bottom', 'Abajo'],
      ]
        .map(([id, name]) =>
          button(
            name,
            'align',
            'Alinea las capas editables respecto al lienzo o la selección.',
            `data-value="${id}"`,
          ),
        )
        .join(
          '',
        )}</div><h3>Espacios uniformes.</h3><div class="design-grid">${button('Repartir horizontal', 'distribute', 'Iguala los espacios entre tres o más capas y conserva los extremos.', `data-value="horizontal"`)}${button('Repartir vertical', 'distribute', 'Iguala los espacios verticales entre tres o más capas.', `data-value="vertical"`)}</div><h3>Auto organizar.</h3><p>Recoloca y reduce las capas para encajarlas en fila, columna o cuadrícula. Es una acción de composición; no crea reglas de layout permanentes.</p><div class="design-grid"><label>Espacio (%)<input type="number" id="design-gap" min="0" max="12" value="4"></label><label>Columnas<input type="number" id="design-columns" min="1" max="4" value="2"></label></div><div class="design-grid">${[
        ['row', 'Fila'],
        ['column', 'Columna'],
        ['grid', 'Cuadrícula'],
      ]
        .map(([id, n]) =>
          button(
            n,
            'organize',
            'Organiza las capas dentro de márgenes seguros; revisa los textos al reducirlos.',
            `data-value="${id}"`,
          ),
        )
        .join('')}</div>`;
    if (tab === 'reuse')
      html = `<h3>Un estilo, varias capas.</h3><p>Copia color, relleno, opacidad, tamaño de letra, estilo y animación. Conserva los textos, archivos, posiciones y tiempos del destino.</p><div class="design-grid">${button('Copiar estilo', 'copy-style', 'Copia el formato visual de una sola capa seleccionada.')}${button('Pegar estilo', 'paste-style', 'Aplica el estilo copiado a las capas editables seleccionadas.')}</div><h3>Tus bloques personales.</h3><p>Guarda varias capas como un bloque y reutilízalo. Cada inserción es una copia editable agrupada; no queda vinculada al original.</p><label>Nombre del bloque<input id="design-block-name" maxlength="70" placeholder="Mi firma y llamada a la acción"></label>${button('Guardar selección como bloque', 'save-block', 'Guarda hasta 40 capas seleccionadas como un bloque local reutilizable.')}<div class="design-blocks">${blocks.map((b) => `<article><strong>${esc(b.name)}</strong><small>${b.layers.length} capas · local</small>${button('Insertar copia', 'insert-block', 'Añade una copia agrupada del bloque a esta escena.', `data-id="${esc(b.id)}"`)}${button('Quitar de mi biblioteca', 'remove-block', 'Retira este bloque guardado; no cambia las copias ya insertadas.', `data-id="${esc(b.id)}"`)}</article>`).join('') || '<p>Tus bloques aparecerán aquí.</p>'}</div>`;
    if (tab === 'formats')
      html = `<h3>Una pieza, varias redes.</h3><p>Crea copias editables con márgenes y tipografía adaptados. Conserva el original, escenas, medios y audio. Revisa el recorte del sujeto y los textos antes de exportar.</p><div class="design-format-options">${[
        ['9:16', 'Reel · TikTok · Short'],
        ['1:1', 'Post cuadrado'],
        ['4:5', 'Post retrato'],
        ['16:9', 'Video horizontal'],
      ]
        .map(
          ([ratio, name]) =>
            `<label><input type="checkbox" data-design-format="${ratio}" ${ratio !== x.format ? 'checked' : ''}>${name}<small>${ratio}</small></label>`,
        )
        .join(
          '',
        )}</div>${button('Crear copias adaptadas', 'formats', 'Crea proyectos independientes en los formatos marcados, con posiciones y tamaños ajustados. No exporta ni publica.')}<h3>Carrusel numerado.</h3><p>Añade un indicador editable de página a cada escena del montaje.</p>${button('Añadir números de página', 'number', 'Añade una capa con número y total a todas las escenas; requiere espacio en sus capas.')}`;
    dialog.querySelector('#design-content').innerHTML = html;
    for (const [id, value] of Object.entries(inputs)) {
      const el = dialog.querySelector('#' + id);
      if (el) el.value = value;
    }
    preview();
  }
  function count() {
    const el = dialog?.querySelector('#design-count');
    if (el) el.textContent = selection.size + ' capas seleccionadas';
  }
  function preview() {
    const c = dialog.querySelector('#design-preview');
    const dims = C.dimensions(p().format, 280);
    c.width = dims[0];
    c.height = dims[1];
    root.LumaCompositor.paint(
      c.getContext('2d'),
      p(),
      previewMedia?.readyState >= 2 ? previewMedia : imageObj,
      previewSeconds || 0,
      assetImages,
    );
  }
  function feedback(text) {
    const el = dialog?.querySelector('#design-feedback');
    if (el) el.textContent = text;
    toast(text);
  }
  function dispatch(e) {
    const el = e.target.closest('[data-design]');
    if (!el) return;
    const a = el.dataset.design,
      v = el.dataset.value;
    try {
      if (a === 'close') {
        dialog.close();
        return;
      }
      if (a === 'tab') {
        tab = v;
        paint();
        return;
      }
      if (a === 'select-all') {
        selection = new Set(
          p()
            .layers.filter((l) => !l.locked && !l.hidden)
            .map((l) => l.id),
        );
        paint();
        return;
      }
      if (a === 'undo') {
        undo();
        paint();
        return;
      }
      const ids = [...selection];
      if (a === 'align') {
        const relative = dialog.querySelector('#design-relative').value,
          bounds = metrics();
        commit((x) => D.align(x.layers, ids, v, relative, bounds));
        feedback('Capas alineadas.');
      }
      if (a === 'distribute') {
        const bounds = metrics();
        commit((x) => D.distribute(x.layers, ids, v, bounds));
        feedback('Espacios repartidos.');
      }
      if (a === 'organize') {
        const gap = dialog.querySelector('#design-gap').value,
          cols = dialog.querySelector('#design-columns').value,
          bounds = metrics();
        commit((x) => D.organize(x.layers, ids, v, gap, cols, bounds));
        feedback('Composición reorganizada. Revisa la vista previa.');
      }
      if (a === 'copy-style') {
        if (ids.length !== 1) throw Error('Selecciona una sola capa como origen del estilo.');
        styleClipboard = D.copyStyle(p().layers.find((l) => l.id === ids[0]));
        feedback('Estilo copiado. Selecciona las capas de destino y pégalo.');
      }
      if (a === 'paste-style') {
        commit((x) => D.pasteStyle(x.layers, ids, styleClipboard));
        feedback('Estilo aplicado sin sustituir contenido ni tiempos.');
      }
      if (a === 'save-block') {
        const name = dialog.querySelector('#design-block-name').value.trim();
        if (!name) throw Error('Pon un nombre al bloque.');
        if (blocks.length >= 12) throw Error('Máximo 12 bloques guardados.');
        const layers = D.reusable(p().layers, ids);
        blocks.push({ id: crypto.randomUUID(), name, layers });
        persistBlocks();
        paint();
        feedback('Bloque guardado en este navegador.');
      }
      if (a === 'insert-block') {
        const b = blocks.find((b) => b.id === el.dataset.id);
        if (!b) throw Error('Bloque no disponible.');
        if (b.layers.some((l) => l.asset && !assets.some((a) => a.id === l.asset)))
          throw Error('Faltan archivos de este bloque. Restaura su respaldo antes de insertarlo.');
        commit((x) => {
          const layers = D.insertBlock(b.layers, x.layers);
          x.layers.push(...layers);
          selection = new Set(layers.map((l) => l.id));
        });
        feedback('Copia del bloque insertada y agrupada.');
      }
      if (a === 'remove-block') {
        blocks = blocks.filter((b) => b.id !== el.dataset.id);
        persistBlocks();
        paint();
      }
      if (a === 'formats') {
        const x = requireProject();
        P.mirror(x);
        const formats = [...dialog.querySelectorAll('[data-design-format]:checked')].map(
          (el) => el.dataset.designFormat,
        );
        if (!formats.length) throw Error('Marca al menos un formato.');
        const copies = formats.map((format) => {
          const c = structuredClone(x);
          c.id = crypto.randomUUID();
          c.name = (x.name + ' · ' + format).slice(0, 100);
          c.created = Date.now();
          c.format = format;
          c.flowVersions = [];
          const index = Math.max(
            0,
            x.scenes.findIndex((s) => s.id === x.activeScene),
          );
          c.scenes = x.scenes.map((s) => P.scene(D.adaptScene(s, x.format, format)));
          c.activeScene = c.scenes[index].id;
          P.activate(c, c.activeScene, false);
          return c;
        });
        projects.unshift(...copies);
        save();
        feedback(copies.length + ' proyectos adaptados. Ábrelos desde Mis proyectos o el tablero.');
      }
      if (a === 'number') {
        commit((x) => {
          P.mirror(x);
          if (x.scenes.some((s) => s.layers.length >= 40))
            throw Error('Una escena ya tiene 40 capas.');
          x.scenes.forEach((s, i) =>
            s.layers.push(
              P.layer({
                kind: 'text',
                text:
                  String(i + 1).padStart(2, '0') + ' / ' + String(x.scenes.length).padStart(2, '0'),
                size: 30,
                x: 84,
                y: 90,
                width: 22,
                height: 5,
                style: 'label',
                color: '#ffffff',
                fill: '#222033',
              }),
            ),
          );
          P.activate(x, x.activeScene, false);
        });
        feedback('Numeración añadida como capas editables.');
      }
    } catch (err) {
      feedback(err.message);
    }
  }
  function mount() {
    if (view !== 'editor' || !p() || document.querySelector('#design-open')) return;
    const actions = document.querySelector('main .actions');
    if (actions)
      actions.insertAdjacentHTML(
        'afterbegin',
        button(
          '◈ Composición Pro',
          'open',
          'Abre alineación, distribución, estilos, bloques y adaptación de formatos.',
          'id="design-open"',
        ),
      );
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('#design-open')) open();
  });
  const renderBase = render;
  render = function () {
    renderBase();
    mount();
  };
  const editorBase = renderEditor;
  renderEditor = function () {
    editorBase();
    mount();
  };
  document.addEventListener('keydown', (e) => {
    if (
      view === 'editor' &&
      p() &&
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === 'k' &&
      !e.target.closest('input,textarea,select,dialog')
    ) {
      e.preventDefault();
      open();
    }
  });
  const backupBase = makeBackup;
  makeBackup = async function (list) {
    const b = await backupBase(list);
    b.designBlocks = structuredClone(blocks);
    const included = new Set(b.media.map((m) => m.id));
    for (const id of new Set(
      b.designBlocks.flatMap((block) => block.layers.map((l) => l.asset)).filter(Boolean),
    )) {
      if (included.has(id)) continue;
      const a = assets.find((a) => a.id === id);
      if (a) {
        b.media.push({ id: a.id, name: a.name, type: a.type, data: await dataURL(a.blob) });
        included.add(id);
      }
    }
    if (b.media.reduce((n, a) => n + a.data.length, 0) > 240 * 1024 * 1024)
      throw Error('El respaldo supera el límite. Reduce los bloques con archivos grandes.');
    return b;
  };
  const restoreBase = restoreCreatorBackup;
  restoreCreatorBackup = function (b, restored, ids) {
    restoreBase(b, restored, ids);
    if (!Array.isArray(b.designBlocks)) return;
    for (const block of b.designBlocks.slice(0, 12 - blocks.length)) {
      if (!block || !Array.isArray(block.layers)) continue;
      blocks.push({
        id: crypto.randomUUID(),
        name: String(block.name || 'Bloque restaurado').slice(0, 70),
        layers: block.layers
          .slice(0, 40)
          .map((l) => P.layer({ ...l, asset: ids.get(l.asset) || null })),
      });
    }
    persistBlocks();
  };
  root.FleremahiasDesign = { open };
  ready.then(mount);
})(window);
