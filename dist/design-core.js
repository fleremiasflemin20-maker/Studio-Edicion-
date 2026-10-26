(function (root) {
  const P = root.LumaCreatorCore || require('./creator-core.js');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function selected(layers, ids) {
    return layers.filter((l) => ids.includes(l.id) && !l.locked && !l.hidden);
  }
  function box(l, metrics = {}) {
    const m = metrics[l.id];
    return {
      x: l.x,
      y: l.y,
      w: clamp(m?.w || l.width || 20, 1, 100),
      h: clamp(m?.h || l.height || 10, 1, 100),
    };
  }
  function align(layers, ids, axis, relative = 'canvas', metrics = {}) {
    const list = selected(layers, ids);
    if (!list.length) throw Error('Selecciona al menos una capa desbloqueada y visible.');
    const boxes = list.map((l) => box(l, metrics));
    const bounds =
      relative === 'selection'
        ? {
            left: Math.min(...boxes.map((b) => b.x - b.w / 2)),
            right: Math.max(...boxes.map((b) => b.x + b.w / 2)),
            top: Math.min(...boxes.map((b) => b.y - b.h / 2)),
            bottom: Math.max(...boxes.map((b) => b.y + b.h / 2)),
          }
        : { left: 6, right: 94, top: 6, bottom: 94 };
    if (!['left', 'center', 'right', 'top', 'middle', 'bottom'].includes(axis))
      throw Error('Alineación desconocida.');
    list.forEach((l) => {
      const b = box(l, metrics);
      if (axis === 'left') l.x = bounds.left + b.w / 2;
      if (axis === 'center') l.x = (bounds.left + bounds.right) / 2;
      if (axis === 'right') l.x = bounds.right - b.w / 2;
      if (axis === 'top') l.y = bounds.top + b.h / 2;
      if (axis === 'middle') l.y = (bounds.top + bounds.bottom) / 2;
      if (axis === 'bottom') l.y = bounds.bottom - b.h / 2;
      l.x = clamp(l.x, b.w / 2, 100 - b.w / 2);
      l.y = clamp(l.y, b.h / 2, 100 - b.h / 2);
    });
    return list.length;
  }
  function distribute(layers, ids, direction, metrics = {}) {
    const list = selected(layers, ids);
    if (list.length < 3) throw Error('Selecciona tres o más capas para repartir los espacios.');
    if (!['horizontal', 'vertical'].includes(direction)) throw Error('Dirección desconocida.');
    const key = direction === 'horizontal' ? 'x' : 'y',
      size = direction === 'horizontal' ? 'w' : 'h';
    list.sort((a, b) => a[key] - b[key]);
    const start = list[0][key] - box(list[0], metrics)[size] / 2,
      end = list.at(-1)[key] + box(list.at(-1), metrics)[size] / 2,
      total = list.reduce((n, l) => n + box(l, metrics)[size], 0),
      gap = (end - start - total) / (list.length - 1);
    if (gap < 0) throw Error('No hay espacio entre los extremos. Sepáralos o usa Auto organizar.');
    let at = start;
    for (const l of list) {
      const s = box(l, metrics)[size];
      l[key] = at + s / 2;
      at += s + gap;
    }
    return gap;
  }
  function organize(layers, ids, mode, gap = 4, columns = 2, metrics = {}) {
    const list = selected(layers, ids);
    if (!list.length) throw Error('Selecciona capas visibles y desbloqueadas.');
    gap = clamp(Number(gap) || 0, 0, 12);
    const cols =
        mode === 'row'
          ? list.length
          : mode === 'column'
            ? 1
            : clamp(Math.floor(columns) || 2, 1, 4),
      rows = Math.ceil(list.length / cols),
      cw = (84 - gap * (cols - 1)) / cols,
      ch = (80 - gap * (rows - 1)) / rows;
    if (cw < 3 || ch < 3)
      throw Error(
        'Hay demasiadas capas para ese espaciado. Reduce el espacio o cambia la cuadrícula.',
      );
    list.forEach((l, i) => {
      const b = box(l, metrics),
        scale = Math.min(1, cw / b.w, ch / b.h);
      l.width = clamp((l.width || b.w) * scale, 5, 100);
      l.height = clamp((l.height || b.h) * scale, 2, 100);
      l.size = clamp((l.size || 48) * scale, 16, 220);
      l.x = 8 + cw / 2 + (i % cols) * (cw + gap);
      l.y = 10 + ch / 2 + Math.floor(i / cols) * (ch + gap);
    });
    return list.length;
  }
  const styleKeys = ['color', 'fill', 'opacity', 'size', 'style', 'animation', 'animationDuration'];
  function copyStyle(layer) {
    const clean = P.layer(layer);
    return Object.fromEntries(styleKeys.map((k) => [k, clean[k]]));
  }
  function pasteStyle(layers, ids, style) {
    if (!style || typeof style !== 'object') throw Error('Copia primero un estilo.');
    const clean = copyStyle(style),
      list = selected(layers, ids);
    if (!list.length) throw Error('Selecciona capas editables.');
    for (const l of list) Object.assign(l, clean);
    return list.length;
  }
  function adaptScene(scene, source, target) {
    const s = structuredClone(scene),
      [sw, sh] = source.split(':').map(Number),
      [tw, th] = target.split(':').map(Number);
    if (![sw, sh, tw, th].every((n) => n > 0 && Number.isFinite(n)))
      throw Error('Formato inválido.');
    const heightRatio = th / tw / (sh / sw),
      fontScale = Math.min(1, heightRatio);
    s.fontSize = clamp(s.fontSize * fontScale, 24, 220);
    s.textX = clamp(s.textX ?? 50, 10, 90);
    s.textY = clamp(s.textY ?? 50, 14, 82);
    s.subtitleY = clamp(s.subtitleY ?? 80, 15, 82);
    s.facePath = [];
    s.cropX = clamp(s.cropX ?? 50, 0, 100);
    s.cropY = clamp(s.cropY ?? 50, 0, 100);
    for (const l of s.layers || []) {
      l.size = clamp(l.size * fontScale, 16, 220);
      if (['image', 'video', 'shape'].includes(l.kind))
        l.height = clamp(l.height / heightRatio, 2, 80);
      l.width = clamp(l.width, 5, 84);
      l.x = clamp(l.x, 8 + l.width / 2, 92 - l.width / 2);
      l.y = clamp(l.y, 12 + Math.min(l.height, 70) / 2, 88 - Math.min(l.height, 70) / 2);
    }
    return s;
  }
  function reusable(layers, ids) {
    const list = layers.filter((l) => ids.includes(l.id));
    if (!list.length) throw Error('Selecciona las capas de tu bloque.');
    return list.slice(0, 40).map((l) => P.layer(l));
  }
  function insertBlock(block, existing = []) {
    if (!Array.isArray(block) || !block.length || block.length + existing.length > 40)
      throw Error('El bloque está vacío o supera 40 capas por escena.');
    const group = crypto.randomUUID();
    return block.map((l) => P.layer({ ...l, locked: false, group }));
  }
  const api = {
    selected,
    box,
    align,
    distribute,
    organize,
    copyStyle,
    pasteStyle,
    adaptScene,
    reusable,
    insertBlock,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FleremahiasDesignCore = api;
})(typeof window === 'undefined' ? globalThis : window);
