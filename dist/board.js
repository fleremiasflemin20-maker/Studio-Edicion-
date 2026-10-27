(function (root) {
  'use strict';
  const B = root.FleremahiasBoardCore,
    key = 'fleremahias-board-v1',
    modeKey = 'fleremahias-focus-v1';
  let state,
    tab = 'tools',
    search = '',
    targetId = current || projects[0]?.id,
    drag = null,
    historyBoard = [],
    ignoreClick = 0,
    saveTimer,
    active = false;
  try {
    state = B.normalize(JSON.parse(localStorage.getItem(key) || '{}'));
  } catch {
    state = B.normalize();
  }
  let focus = false;
  try {
    focus = localStorage.getItem(modeKey) === 'on';
  } catch {}
  const uid = () => crypto.randomUUID(),
    html = esc;
  function persist() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      toast('No se pudo guardar el tablero. Descarga un respaldo.');
    }
  }
  function checkpoint(project) {
    historyBoard.push({
      board: structuredClone(state),
      project: project ? structuredClone(project) : null,
    });
    if (historyBoard.length > 12) historyBoard.shift();
  }
  function busy() {
    return rendering || batchBusy || labBusy;
  }
  function node(type, ref = '', pos) {
    const stage = document.querySelector('.board-stage');
    const point =
      pos ||
      B.toWorld({ x: Math.min(stage?.clientWidth || 700, 800) / 2 - 120, y: 160 }, state.camera);
    return {
      id: uid(),
      type,
      ref,
      x: Math.round(point.x / 20) * 20,
      y: Math.round(point.y / 20) * 20,
      w: type === 'section' ? 820 : 260,
      h: type === 'section' ? 500 : type === 'project' || type === 'media' ? 310 : 260,
      text:
        type === 'note'
          ? 'Escribe tu idea, guion o pendiente…'
          : type === 'section'
            ? 'Mi campaña'
            : '',
      tone: type === 'note' ? 'peach' : 'violet',
    };
  }
  function add(type, ref = '', pos) {
    if (state.nodes.length >= 120) return toast('Máximo 120 tarjetas por tablero.');
    checkpoint();
    const n = node(type, ref, pos);
    state.nodes.push(n);
    state.selected = n.id;
    persist();
    paintNodes();
    return n;
  }
  function selectedProject() {
    return projects.find((x) => x.id === targetId);
  }
  function projectFor(n) {
    return projects.find((x) => x.id === n?.ref);
  }
  function setFocus(on) {
    focus = on;
    try {
      localStorage.setItem(modeKey, on ? 'on' : 'off');
    } catch {}
    document.body.classList.toggle('focus-workspace', on && view === 'editor');
    mountModes();
  }
  function openFocus(id = targetId) {
    if (busy()) return toast('Espera a que termine el proceso actual.');
    const x = projects.find((x) => x.id === id);
    if (!x) {
      go('editor');
      return toast('Crea o abre un proyecto para entrar en enfoque.');
    }
    targetId = x.id;
    current = x.id;
    focus = true;
    try {
      localStorage.setItem(modeKey, 'on');
    } catch {}
    go('editor');
  }
  function actionButton(label, action, description, extra = '') {
    return `<button type="button" data-board-action="${action}" data-help-description="${html(description)}" ${extra}>${label}</button>`;
  }
  function mountModes() {
    const bar = document.querySelector('#workspace-switcher');
    if (!bar) return;
    bar.innerHTML = `<div><span class="workspace-live-dot"></span><span>FLEREMAHIAS · CREATIVE SPACE</span></div><div class="workspace-modes" role="group" aria-label="Modo de trabajo">${actionButton('◎ Modo enfoque', 'focus-mode', 'Abre la edición de una pieza con más espacio para el lienzo. No es un plan de pago.', `aria-pressed="${view === 'editor' && focus}"`)}${actionButton('▦ Modo tablero', 'board-mode', 'Abre el tablero visual de proyectos, medios, notas y herramientas.', `aria-pressed="${view === 'board'}"`)}${view === 'board' ? actionButton('← Estudio', 'home', 'Vuelve a la vista general del estudio.') : ''}${view === 'editor' && focus ? actionButton('Paneles normales', 'normal-mode', 'Vuelve a mostrar la navegación y el espacio de edición normal.') : ''}</div>`;
  }
  function renderBoard() {
    const firstBoard = !state.nodes.length;
    active = true;
    document.body.classList.add('board-active');
    if (!state.nodes.length) {
      state.nodes.push(
        {
          ...node('note', '', { x: 20, y: 20 }),
          text: StudioI18n.t(
            'Tu próxima campaña empieza aquí.\n\nArrastra proyectos, medios o herramientas al tablero. Suelta un filtro o un medio sobre un proyecto para aplicarlo.',
          ),
        },
        node('tool', 'cinema', { x: 20, y: 280 }),
      );
      projects
        .slice(0, 3)
        .forEach((x, i) => state.nodes.push(node('project', x.id, { x: 340 + i * 300, y: 40 })));
      persist();
    }
    if (!selectedProject()) targetId = projects[0]?.id;
    document.querySelector('main').innerHTML =
      `<section class="board-shell"><div class="board-heading"><div><small>FLEREMAHIAS · CREATIVE SPACE</small><h1>Ideas en movimiento.</h1><p>Organiza tu campaña. Arrastra una herramienta sobre una pieza para trabajar en ella.</p></div><span class="board-local">● Tablero guardado localmente</span></div><div class="board-toolbar"><div class="board-actions">${actionButton('＋ Nota', 'note', 'Añade una nota editable al tablero.')}${actionButton('▱ Zona', 'section', 'Añade una zona para agrupar tarjetas de una campaña.')}${actionButton('Ordenar', 'arrange', 'Ordena las tarjetas en una cuadrícula. Las zonas se mantienen en su posición.')}${actionButton('↶ Deshacer', 'undo', 'Deshace hasta doce acciones del tablero en esta sesión, incluidos los cambios aplicados a una pieza.')}${actionButton('↓ Respaldo', 'backup', 'Descarga proyectos, archivos y la organización del tablero.')}</div><div class="board-zoom">${actionButton('−', 'zoom-out', 'Aleja la vista del tablero.')}<output id="board-zoom-label">100%</output>${actionButton('＋', 'zoom-in', 'Acerca la vista del tablero.')}${actionButton('Ajustar', 'fit', 'Encuadra todas las tarjetas del tablero.')}</div></div><div class="board-workspace"><section class="board-dock" aria-label="Recursos del tablero"><div class="board-dock-tabs">${['tools', 'projects', 'media'].map((id, i) => actionButton(['Herramientas', 'Proyectos', 'Medios'][i], 'tab', 'Muestra recursos que puedes añadir al tablero.', `data-tab="${id}" aria-pressed="${tab === id}"`)).join('')}</div><label class="board-search">Buscar<input id="board-search" type="search" value="${html(search)}" placeholder="Busca una pieza…"></label><div id="board-palette"></div><p>Arrastra al tablero o toca ＋. Los filtros y medios también pueden soltarse sobre una tarjeta de proyecto.</p></section><section class="board-stage" tabindex="0" aria-label="Tablero visual. Arrastra el fondo para desplazarte; usa zoom y las flechas de una tarjeta para moverla."><div class="board-world" id="board-world"></div><div class="board-stage-hint">Arrastra el fondo · Ctrl/⌘ + rueda: zoom · Flechas: mover tarjeta · Shift: paso grande</div><div class="board-target"><label>Proyecto de destino<select id="board-target"><option value="">Selecciona una pieza</option>${projects.map((x) => `<option value="${html(x.id)}" ${x.id === targetId ? 'selected' : ''}>${html(x.name)}</option>`).join('')}</select></label>${actionButton('Abrir en enfoque ↗', 'open-target', 'Abre el proyecto de destino para editar escenas, capas, audio y exportación.')}</div></section></div><p class="board-footer" role="status" id="board-status">${state.nodes.length} tarjetas · Retirar una tarjeta no elimina el proyecto ni sus archivos.</p></section>`;
    document.querySelector('#board-search').oninput = (e) => {
      search = e.target.value;
      paintPalette();
    };
    document.querySelector('#board-target').onchange = (e) => {
      targetId = e.target.value;
    };
    paintPalette();
    paintNodes();
    if (firstBoard) {
      const stage = document.querySelector('.board-stage');
      state.camera = B.fit(state.nodes, stage.clientWidth, stage.clientHeight);
      persist();
    }
    camera();
  }
  function paintPalette() {
    const host = document.querySelector('#board-palette');
    if (!host) return;
    let items = [];
    if (tab === 'tools')
      items = B.tools.map((t) => ({
        type: 'tool',
        ref: t.id,
        name: t.name,
        icon: t.icon,
        tone: t.tone,
        hint: t.hint,
      }));
    if (tab === 'projects')
      items = projects.map((x) => ({
        type: 'project',
        ref: x.id,
        name: x.name,
        icon: '▯',
        tone: 'violet',
        hint: 'Añade una tarjeta enlazada al proyecto. Doble clic o Abrir lo lleva al editor.',
      }));
    if (tab === 'media')
      items = assets.map((a) => ({
        type: 'media',
        ref: a.id,
        name: a.name,
        icon: a.type.startsWith('audio') ? '♫' : a.type.startsWith('video') ? '▶' : '▧',
        tone: 'mint',
        hint: 'Añade este recurso al tablero o suéltalo sobre un proyecto.',
      }));
    items = items
      .filter((i) =>
        (i.name + ' ' + StudioI18n.t(i.name)).toLowerCase().includes(search.toLowerCase()),
      )
      .slice(0, 80);
    host.innerHTML =
      items
        .map(
          (i) =>
            `<div class="board-palette-item tone-${i.tone}" data-board-source="${i.type}" data-ref="${html(i.ref)}"><span>${i.icon}</span><div><strong>${html(i.name)}</strong><small>${html(i.hint)}</small></div>${actionButton('＋', 'add', i.hint, `data-type="${i.type}" data-ref="${html(i.ref)}" aria-label="Añadir ${html(i.name)} al tablero"`)}</div>`,
        )
        .join('') ||
      `<div class="board-empty"><p>${tab === 'projects' ? 'Crea tu primera pieza para añadirla.' : tab === 'media' ? 'Importa archivos para verlos aquí.' : 'No hay coincidencias.'}</p>${tab === 'projects' ? actionButton('Nuevo proyecto', 'new', 'Abre el formulario de creación.') : tab === 'media' ? actionButton('Importar', 'import', 'Importa tus imágenes, video o audio.') : ''}</div>`;
  }
  function nodeContent(n) {
    if (n.type === 'note' || n.type === 'section')
      return `<label>${n.type === 'note' ? 'Idea / guion' : 'Nombre de la zona'}<textarea data-board-note="${n.id}" aria-label="${n.type === 'note' ? 'Nota del tablero' : 'Nombre de la zona'}">${html(n.text)}</textarea></label>`;
    if (n.type === 'tool') {
      const t = B.tools.find((t) => t.id === n.ref);
      return t
        ? `<div class="board-tool-icon">${t.icon}</div><h3>${t.name}</h3><p>${t.hint}</p>${actionButton('Usar en destino ↗', 'apply', t.hint, `data-id="${n.id}"`)}`
        : '<p>Herramienta no disponible.</p>';
    }
    if (n.type === 'project') {
      const x = projectFor(n);
      if (!x) return '<p>Proyecto ausente. Importa su respaldo o retira esta tarjeta.</p>';
      const a = assets.find((a) => a.id === x.asset);
      return `<div class="board-project-preview" style="--project-bg:${/^#[a-f0-9]{6}$/i.test(x.bg) ? x.bg : '#242032'}">${a?.type.startsWith('image') ? `<img src="${html(a.url)}" alt="">` : a?.type.startsWith('video') ? `<video src="${html(a.url)}" preload="metadata" muted playsinline></video>` : ''}<strong>${html((x.text || x.name).slice(0, 100))}</strong><em class="board-look">${html(P.filters.find((f) => f.id === x.filter)?.name || 'Original')}</em><span>${html(x.format)}</span></div><h3>${html(x.name)}</h3><small>${x.scenes?.length || 1} escenas · ${html(x.platform || 'Contenido social')}</small>${actionButton('Abrir en enfoque ↗', 'focus', 'Abre esta pieza en el editor.', `data-ref="${html(x.id)}"`)}`;
    }
    const a = assets.find((a) => a.id === n.ref);
    if (!a) return '<p>Recurso ausente en este navegador.</p>';
    return `<div class="board-media-preview">${a.type.startsWith('image') ? `<img src="${html(a.url)}" alt="${html(a.name)}">` : a.type.startsWith('video') ? `<video src="${html(a.url)}" preload="metadata" muted playsinline></video>` : `<span>♫</span>`}</div><h3>${html(a.name)}</h3>${actionButton('Añadir al destino', 'apply', 'Añade el medio al proyecto de destino: imagen/video como escena y audio como música.', `data-id="${n.id}"`)}`;
  }
  function paintNodes() {
    const world = document.querySelector('#board-world');
    if (!world) return;
    world.innerHTML = [...state.nodes]
      .sort((a, b) => (a.type === 'section' ? 0 : 1) - (b.type === 'section' ? 0 : 1))
      .map(
        (n) =>
          `<article class="board-node board-${n.type} tone-${n.type === 'tool' ? B.tools.find((t) => t.id === n.ref)?.tone || n.tone : n.tone} ${state.selected === n.id ? 'is-selected' : ''}" data-board-node="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;" tabindex="0" aria-label="${n.type === 'project' ? html(projectFor(n)?.name || 'Proyecto ausente') : n.type === 'tool' ? html(B.tools.find((t) => t.id === n.ref)?.name || 'Herramienta') : n.type === 'note' ? 'Nota del tablero' : n.type === 'media' ? 'Recurso del tablero' : 'Zona de campaña'}"><div class="board-node-grip" data-board-grip="${n.id}"><small>${{ project: 'PIEZA', media: 'RECURSO', tool: 'HERRAMIENTA', note: 'IDEA', section: 'ZONA' }[n.type]}</small>${actionButton('×', 'remove', 'Retira la tarjeta del tablero sin eliminar el proyecto ni el archivo.', `data-id="${n.id}" aria-label="Retirar tarjeta"`)}</div><div class="board-node-body">${nodeContent(n)}</div></article>`,
      )
      .join('');
    const status = document.querySelector('#board-status');
    if (status)
      status.textContent = `${state.nodes.length} tarjetas · Retirar una tarjeta no elimina el proyecto ni sus archivos.`;
  }
  function camera() {
    const world = document.querySelector('#board-world'),
      stage = document.querySelector('.board-stage');
    if (!world) return;
    const c = state.camera;
    world.style.transform = `translate(${c.x}px,${c.y}px) scale(${c.zoom})`;
    stage.style.backgroundPosition = `${c.x}px ${c.y}px`;
    stage.style.backgroundSize = `${24 * c.zoom}px ${24 * c.zoom}px`;
    document.querySelector('#board-zoom-label').textContent = Math.round(c.zoom * 100) + '%';
  }
  function apply(type, ref, projectId = targetId) {
    const x = projects.find((x) => x.id === projectId);
    if (!x) return toast('Selecciona un proyecto de destino o arrastra sobre su tarjeta.');
    if (busy()) return toast('Espera a que termine el proceso actual.');
    if (type === 'tool') {
      const t = B.tools.find((t) => t.id === ref);
      if (!t) return;
      if (t.flow || t.pro || t.view) {
        current = x.id;
        targetId = x.id;
        go('editor');
        if (t.flow) root.LumaFlow.open(t.flow);
        else if (t.pro) root.LumaPro.open(t.pro);
        else go(t.view);
        return;
      }
      if (t.effect === 'title' && (x.layers || []).length >= 40)
        return toast('Máximo 40 capas por escena.');
      checkpoint(x);
      P.ensure(x);
      P.mirror(x);
      if (t.effect === 'filter') for (const s of x.scenes) s.filter = t.filter;
      if (t.effect === 'title') {
        const s = x.scenes.find((s) => s.id === x.activeScene);
        s.layers.push(
          P.layer({
            kind: 'text',
            text: 'Tu próxima gran idea',
            x: 50,
            y: 32,
            size: 56,
            color: '#ffffff',
            style: 'editorial',
          }),
        );
      }
      P.activate(x, x.activeScene, false);
      save();
      persist();
      paintNodes();
      toast(t.name + ' aplicado. Puedes deshacer desde el tablero.');
    }
    if (type === 'media') {
      const a = assets.find((a) => a.id === ref);
      if (!a) return toast('Este archivo ya no está disponible.');
      if (!a.type.startsWith('audio') && x.scenes?.length >= 24)
        return toast('Máximo 24 escenas por proyecto.');
      checkpoint(x);
      P.ensure(x);
      P.mirror(x);
      if (a.type.startsWith('audio')) x.audio = a.id;
      else {
        x.scenes.push(P.scene({ asset: a.id, name: a.name, text: '', duration: 4, bg: '#222033' }));
      }
      P.activate(x, x.activeScene, false);
      save();
      persist();
      paintNodes();
      toast(
        a.type.startsWith('audio') ? 'Música añadida al proyecto.' : 'Escena añadida al proyecto.',
      );
    }
  }
  function undoBoard() {
    const h = historyBoard.pop();
    if (!h) return toast('No hay acciones del tablero para deshacer.');
    state = h.board;
    if (h.project) {
      const i = projects.findIndex((x) => x.id === h.project.id);
      if (i >= 0) projects[i] = h.project;
      save();
    }
    persist();
    paintNodes();
    camera();
    toast('Acción del tablero deshecha.');
  }
  function actions(e) {
    const b = e.target.closest('[data-board-action]');
    if (!b || performance.now() < ignoreClick) return;
    const a = b.dataset.boardAction;
    if (a === 'focus-mode') return openFocus();
    if (a === 'home') {
      go('home');
      return;
    }
    if (a === 'board-mode') {
      if (!busy()) go('board');
      return;
    }
    if (a === 'normal-mode') {
      setFocus(false);
      return;
    }
    if (view !== 'board') return;
    if (a === 'tab') {
      tab = b.dataset.tab;
      search = '';
      renderBoard();
    }
    if (a === 'add') add(b.dataset.type, b.dataset.ref);
    if (a === 'note' || a === 'section') add(a);
    if (a === 'focus') openFocus(b.dataset.ref);
    if (a === 'open-target') openFocus();
    if (a === 'new') newProject();
    if (a === 'import') importFiles();
    if (a === 'backup') backupAll();
    if (a === 'undo') undoBoard();
    if (a === 'remove') {
      checkpoint();
      state.nodes = state.nodes.filter((n) => n.id !== b.dataset.id);
      state.selected = null;
      persist();
      paintNodes();
    }
    if (a === 'apply') {
      const n = state.nodes.find((n) => n.id === b.dataset.id);
      if (n) apply(n.type, n.ref);
    }
    if (a === 'fit') {
      const el = document.querySelector('.board-stage');
      state.camera = B.fit(state.nodes, el.clientWidth, el.clientHeight);
      persist();
      camera();
    }
    if (a === 'zoom-in' || a === 'zoom-out') {
      const el = document.querySelector('.board-stage');
      state.camera = B.zoomAt(
        state.camera,
        state.camera.zoom * (a === 'zoom-in' ? 1.15 : 1 / 1.15),
        { x: el.clientWidth / 2, y: el.clientHeight / 2 },
      );
      persist();
      camera();
    }
    if (a === 'arrange') {
      checkpoint();
      let i = 0;
      state.nodes
        .filter((n) => n.type !== 'section')
        .forEach((n) => {
          n.x = 40 + (i % 3) * 300;
          n.y = 40 + Math.floor(i / 3) * 340;
          i++;
        });
      persist();
      paintNodes();
    }
  }
  document.addEventListener('click', actions);
  document.addEventListener('click', (e) => {
    if (view !== 'board' || performance.now() < ignoreClick) return;
    const el = e.target.closest('[data-board-node]');
    if (!el || e.target.closest('button,input,textarea')) return;
    state.selected = el.dataset.boardNode;
    const n = state.nodes.find((n) => n.id === state.selected);
    if (n?.type === 'project') {
      targetId = n.ref;
      document.querySelector('#board-target').value = targetId;
    }
    document
      .querySelectorAll('[data-board-node]')
      .forEach((el) => el.classList.toggle('is-selected', el.dataset.boardNode === state.selected));
    persist();
  });
  document.addEventListener('dblclick', (e) => {
    const n = state.nodes.find(
      (n) => n.id === e.target.closest('[data-board-node]')?.dataset.boardNode,
    );
    if (view === 'board' && n?.type === 'project' && !e.target.closest('button')) openFocus(n.ref);
  });
  document.addEventListener('focusin', (e) => {
    if (e.target.matches('[data-board-note]')) checkpoint();
  });
  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-board-note]')) return;
    const n = state.nodes.find((n) => n.id === e.target.dataset.boardNote);
    if (n) {
      n.text = e.target.value.slice(0, 4000);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persist, 300);
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (
      view !== 'board' ||
      document.body.classList.contains('help-inspecting') ||
      e.button > 0 ||
      e.target.closest('[data-help-ui]') ||
      e.target.closest('button,input,select,textarea')
    )
      return;
    const source = e.target.closest('[data-board-source]'),
      grip = e.target.closest('[data-board-grip]'),
      stage = e.target.closest('.board-stage');
    if (
      !source &&
      !grip &&
      (!stage || e.target.closest('[data-board-node],.board-target,.board-stage-hint'))
    )
      return;
    const n = grip ? state.nodes.find((n) => n.id === grip.dataset.boardGrip) : null;
    drag = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      el: source || grip || stage,
      source: source ? { type: source.dataset.boardSource, ref: source.dataset.ref } : null,
      node: n,
      positions: n
        ? state.nodes
            .filter((q) =>
              [n.id, ...(n.type === 'section' ? B.members(state.nodes, n) : [])].includes(q.id),
            )
            .map((q) => ({ id: q.id, x: q.x, y: q.y }))
        : [],
      camera: { ...state.camera },
      moved: false,
      touch: e.pointerType === 'touch',
      at: performance.now(),
    };
    if (!drag.touch || stage) e.preventDefault();
  });
  document.addEventListener(
    'pointermove',
    (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag,
        dx = e.clientX - d.startX,
        dy = e.clientY - d.startY;
      if (!d.moved) {
        if (d.source && d.touch && performance.now() - d.at < 220) {
          if (Math.hypot(dx, dy) > 8) drag = null;
          return;
        }
        if (Math.hypot(dx, dy) < 6) return;
        d.moved = true;
        if (d.node) checkpoint();
        d.el.setPointerCapture?.(e.pointerId);
        if (d.source) {
          d.ghost = document.createElement('div');
          d.ghost.className = 'board-drag-ghost';
          d.ghost.textContent =
            d.source.type === 'tool'
              ? B.tools.find((t) => t.id === d.source.ref)?.name || 'Herramienta'
              : d.source.type === 'project'
                ? projects.find((p) => p.id === d.source.ref)?.name || 'Proyecto'
                : assets.find((a) => a.id === d.source.ref)?.name || 'Recurso';
          document.body.append(d.ghost);
        }
      }
      e.preventDefault();
      if (d.ghost) {
        d.ghost.style.left = e.clientX + 14 + 'px';
        d.ghost.style.top = e.clientY + 14 + 'px';
      }
      if (d.node) {
        for (const p of d.positions) {
          const n = state.nodes.find((n) => n.id === p.id);
          n.x = p.x;
          n.y = p.y;
        }
        B.move(
          state.nodes,
          d.positions.map((p) => p.id),
          dx / state.camera.zoom,
          dy / state.camera.zoom,
          !e.altKey,
        );
        for (const p of d.positions) {
          const n = state.nodes.find((n) => n.id === p.id),
            el = document.querySelector(`[data-board-node="${CSS.escape(p.id)}"]`);
          if (el) {
            el.style.left = n.x + 'px';
            el.style.top = n.y + 'px';
          }
        }
      } else if (!d.source) {
        state.camera.x = Math.max(-15000, Math.min(15000, d.camera.x + dx));
        state.camera.y = Math.max(-15000, Math.min(15000, d.camera.y + dy));
        camera();
      }
      document
        .querySelectorAll('.board-drop-target')
        .forEach((el) => el.classList.remove('board-drop-target'));
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.board-project');
      if (
        over &&
        (d.source?.type === 'tool' ||
          d.source?.type === 'media' ||
          d.node?.type === 'tool' ||
          d.node?.type === 'media')
      )
        over.classList.add('board-drop-target');
    },
    { passive: false },
  );
  function finishDrag(e, cancel = false) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    d.ghost?.remove();
    document
      .querySelectorAll('.board-drop-target')
      .forEach((el) => el.classList.remove('board-drop-target'));
    if (!d.moved) return;
    ignoreClick = performance.now() + 350;
    if (cancel) {
      for (const p of d.positions) {
        const n = state.nodes.find((n) => n.id === p.id);
        n.x = p.x;
        n.y = p.y;
      }
      if (d.node) historyBoard.pop();
      state.camera = d.camera;
      persist();
      paintNodes();
      camera();
      return;
    }
    const stage = document.querySelector('.board-stage'),
      rect = stage?.getBoundingClientRect();
    const inside =
      rect &&
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    const targetEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.board-project'),
      target = state.nodes.find((n) => n.id === targetEl?.dataset.boardNode),
      item = d.source || d.node;
    if (target && ['tool', 'media'].includes(item?.type)) {
      if (d.node) {
        for (const p of d.positions) {
          const n = state.nodes.find((n) => n.id === p.id);
          n.x = p.x;
          n.y = p.y;
        }
        historyBoard.pop();
      }
      targetId = target.ref;
      apply(item.type, item.ref, target.ref);
    } else if (d.source && inside)
      add(
        d.source.type,
        d.source.ref,
        B.toWorld(
          {
            x: e.clientX - rect.left - 100 * state.camera.zoom,
            y: e.clientY - rect.top - 25 * state.camera.zoom,
          },
          state.camera,
        ),
      );
    persist();
    if (view === 'board') {
      paintNodes();
      camera();
    }
  }
  document.addEventListener('pointerup', (e) => finishDrag(e));
  document.addEventListener('pointercancel', (e) => finishDrag(e, true));
  document.addEventListener(
    'wheel',
    (e) => {
      const el = e.target.closest('.board-stage');
      if (view !== 'board' || !el) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        state.camera = B.zoomAt(state.camera, state.camera.zoom * Math.exp(-e.deltaY * 0.003), {
          x: e.clientX - r.left,
          y: e.clientY - r.top,
        });
      } else {
        state.camera.x -= e.deltaX;
        state.camera.y -= e.deltaY;
      }
      camera();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persist, 200);
    },
    { passive: false },
  );
  document.addEventListener('keydown', (e) => {
    if (
      view !== 'board' ||
      document.body.classList.contains('help-inspecting') ||
      e.target.closest('input,textarea,select,dialog,[data-help-ui]')
    )
      return;
    if (e.key === 'Escape' && drag) {
      finishDrag({ pointerId: drag.id }, true);
      return;
    }
    const el = e.target.closest('[data-board-node]'),
      n = state.nodes.find((n) => n.id === el?.dataset.boardNode);
    if (n && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      checkpoint();
      const amount = e.shiftKey ? 100 : 20;
      B.move(
        state.nodes,
        [n.id, ...(n.type === 'section' ? B.members(state.nodes, n) : [])],
        e.key === 'ArrowLeft' ? -amount : e.key === 'ArrowRight' ? amount : 0,
        e.key === 'ArrowUp' ? -amount : e.key === 'ArrowDown' ? amount : 0,
      );
      persist();
      for (const moved of state.nodes) {
        const item = document.querySelector('[data-board-node=\"' + CSS.escape(moved.id) + '\"]');
        if (item) {
          item.style.left = moved.x + 'px';
          item.style.top = moved.y + 'px';
        }
      }
    }
    if (n && e.key === 'Enter' && n.type === 'project') {
      e.preventDefault();
      openFocus(n.ref);
    }
  });

  async function importToBoard(files, point) {
    if (busy()) return toast('Espera a que termine el proceso actual.');
    const selected = [...files]
      .filter((f) => /^(image|video|audio)\//.test(f.type))
      .slice(0, Math.min(24, 120 - state.nodes.length));
    if (!selected.length)
      return toast('Suelta imágenes, videos o audio. El tablero admite hasta 120 tarjetas.');
    checkpoint();
    let count = 0;
    for (const file of selected) {
      try {
        const a = await storeAsset(file, file.name);
        state.nodes.push(
          node(
            'media',
            a.id,
            point
              ? { x: point.x + (count % 3) * 300, y: point.y + Math.floor(count / 3) * 340 }
              : undefined,
          ),
        );
        count++;
      } catch (e) {
        toast(e.message);
        break;
      }
    }
    persist();
    if (view === 'board') {
      paintNodes();
      paintPalette();
    }
    toast(count + ' archivos añadidos al tablero y biblioteca.');
  }
  const fileInput = document.querySelector('#files'),
    fileImportBase = fileInput.onchange;
  fileInput.onchange = async function (e) {
    if (view !== 'board') return fileImportBase(e);
    try {
      await importToBoard(e.target.files);
    } finally {
      e.target.value = '';
    }
  };
  document.addEventListener('dragover', (e) => {
    const stage = e.target.closest('.board-stage');
    if (view === 'board' && stage && e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      stage.classList.add('board-file-over');
    }
  });
  document.addEventListener('dragleave', (e) => {
    const stage = e.target.closest('.board-stage');
    if (stage && !stage.contains(e.relatedTarget)) stage.classList.remove('board-file-over');
  });
  document.addEventListener(
    'drop',
    (e) => {
      const stage = e.target.closest('.board-stage');
      if (view !== 'board' || !stage || !e.dataTransfer?.files.length) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      stage.classList.remove('board-file-over');
      const r = stage.getBoundingClientRect();
      importToBoard(
        e.dataTransfer.files,
        B.toWorld({ x: e.clientX - r.left, y: e.clientY - r.top }, state.camera),
      );
    },
    true,
  );
  views.push(['board', '▦', 'Tablero creativo']);
  const navButton = document.createElement('button');
  navButton.dataset.view = 'board';
  navButton.textContent = '▦   Tablero creativo';
  navButton.onclick = () => go('board');
  document.querySelector('body > aside nav').prepend(navButton);
  const renderBase = render;
  render = function () {
    if (view !== 'board' && active) {
      persist();
      historyBoard = [];
      active = false;
    }
    document.body.classList.toggle('board-active', view === 'board');
    renderBase();
    if (view === 'board') renderBoard();
    document.body.classList.toggle('focus-workspace', view === 'editor' && focus);
    mountModes();
  };
  const makeBackupBase = makeBackup;
  makeBackup = async function (list) {
    const backup = await makeBackupBase(list);
    const refs = new Set(list.map((x) => x.id));
    const nodes = state.nodes.filter((n) => n.type !== 'project' || refs.has(n.ref));
    backup.workspace = B.normalize({ ...state, nodes });
    const included = new Set(backup.media.map((m) => m.id));
    for (const n of nodes.filter((n) => n.type === 'media')) {
      if (included.has(n.ref)) continue;
      const a = assets.find((a) => a.id === n.ref);
      if (a) {
        backup.media.push({ id: a.id, name: a.name, type: a.type, data: await dataURL(a.blob) });
        included.add(a.id);
      }
    }
    if (backup.media.reduce((sum, a) => sum + a.data.length, 0) > 240 * 1024 * 1024)
      throw Error('Respaldo demasiado grande. Exporta proyectos por separado.');
    return backup;
  };
  const restoreBase = restoreCreatorBackup;
  restoreCreatorBackup = function (backup, restored, mediaIds) {
    restoreBase(backup, restored, mediaIds);
    if (!backup.workspace) return;
    checkpoint();
    const mapping = new Map(backup.projects.map((x, i) => [x.id, restored[i]?.id]));
    const incoming = B.normalize(backup.workspace);
    incoming.nodes = incoming.nodes.filter((n) =>
      n.type === 'project' ? mapping.has(n.ref) : n.type === 'media' ? mediaIds.has(n.ref) : true,
    );
    for (const n of incoming.nodes) {
      n.id = uid();
      if (n.type === 'project') n.ref = mapping.get(n.ref);
      if (n.type === 'media') n.ref = mediaIds.get(n.ref);
      n.x += 80;
      n.y += 80;
    }
    state.nodes = [...state.nodes, ...incoming.nodes].slice(0, 120);
    persist();
  };
  root.FleremahiasBoard = { open: () => go('board'), focus: openFocus };
  ready.then(() => {
    mountModes();
  });
})(window);
