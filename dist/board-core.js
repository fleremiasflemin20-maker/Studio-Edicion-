(function (root) {
  const clamp = (v, a, b, d = 0) =>
    Number.isFinite(Number(v)) ? Math.min(b, Math.max(a, Number(v))) : d;
  const tools = [
    {
      id: 'title',
      name: 'Título editorial',
      icon: 'T',
      tone: 'violet',
      hint: 'Añade un título editable a la escena activa.',
      effect: 'title',
    },
    {
      id: 'cinema',
      name: 'Look cine',
      icon: '◐',
      tone: 'peach',
      hint: 'Aplica el filtro Cine a todas las escenas.',
      effect: 'filter',
      filter: 'cinema',
    },
    {
      id: 'vivid',
      name: 'Color vivo',
      icon: '✦',
      tone: 'mint',
      hint: 'Aplica el filtro Vibrante a todas las escenas.',
      effect: 'filter',
      filter: 'vivid',
    },
    {
      id: 'clean',
      name: 'Sin filtro',
      icon: '↺',
      tone: 'blue',
      hint: 'Devuelve todas las escenas al filtro Original.',
      effect: 'filter',
      filter: 'original',
    },
    {
      id: 'captions',
      name: 'Subtítulos',
      icon: 'CC',
      tone: 'blue',
      hint: 'Abre Voz y texto para transcribir y revisar.',
      flow: 'text',
    },
    {
      id: 'audio',
      name: 'Mejorar voz',
      icon: '◉',
      tone: 'mint',
      hint: 'Abre Audio y ritmo para revisar y mejorar la voz.',
      flow: 'audio',
    },
    {
      id: 'covers',
      name: 'Portadas',
      icon: '▧',
      tone: 'peach',
      hint: 'Abre Portadas y estilos para generar propuestas.',
      flow: 'design',
    },
    {
      id: 'record',
      name: 'Grabar',
      icon: '●',
      tone: 'rose',
      hint: 'Abre la grabadora; tú decides cuándo empezar.',
      flow: 'record',
    },
    {
      id: 'tracks',
      name: 'Capas y pistas',
      icon: '▱',
      tone: 'violet',
      hint: 'Abre la composición de video, imagen y audio.',
      flow: 'tracks',
    },
    {
      id: 'quick',
      name: 'Estilos de un clic',
      icon: '⚡',
      tone: 'peach',
      hint: 'Abre estilos y bloques editables.',
      pro: 'text',
    },
    {
      id: 'export',
      name: 'Exportar',
      icon: '↗',
      tone: 'blue',
      hint: 'Abre la cola de exportación; no exporta automáticamente.',
      flow: 'jobs',
    },
    {
      id: 'publish',
      name: 'Preparar redes',
      icon: '◎',
      tone: 'mint',
      hint: 'Abre preparación local de formatos y descripciones.',
      view: 'publish',
    },
  ];
  function normalize(raw = {}) {
    const ids = new Set();
    const nodes = (Array.isArray(raw.nodes) ? raw.nodes : [])
      .slice(0, 120)
      .filter((n) => n && ['project', 'media', 'note', 'tool', 'section'].includes(n.type))
      .map((n, i) => {
        let id = typeof n.id === 'string' ? n.id.slice(0, 100) : 'node-' + i;
        while (ids.has(id)) id += '-' + i;
        ids.add(id);
        return {
          id,
          type: n.type,
          ref: String(n.ref || '').slice(0, 100),
          x: clamp(n.x, -10000, 10000),
          y: clamp(n.y, -10000, 10000),
          w: clamp(n.w, n.type === 'section' ? 350 : 220, 1200, n.type === 'section' ? 820 : 260),
          h: clamp(n.h, n.type === 'section' ? 220 : 140, 1000, n.type === 'section' ? 500 : 220),
          text: String(n.text || '').slice(0, 4000),
          tone: ['violet', 'mint', 'peach', 'blue', 'rose'].includes(n.tone) ? n.tone : 'violet',
        };
      });
    return {
      version: 1,
      nodes,
      camera: {
        x: clamp(raw.camera?.x, -15000, 15000, 40),
        y: clamp(raw.camera?.y, -15000, 15000, 40),
        zoom: clamp(raw.camera?.zoom, 0.3, 1.6, 1),
      },
      selected: ids.has(raw.selected) ? raw.selected : null,
    };
  }
  function toWorld(point, camera) {
    return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom };
  }
  function zoomAt(camera, zoom, point) {
    const z = clamp(zoom, 0.3, 1.6, 1),
      w = toWorld(point, camera);
    return { zoom: z, x: point.x - w.x * z, y: point.y - w.y * z };
  }
  function members(nodes, section) {
    return nodes
      .filter(
        (n) =>
          n.id !== section.id &&
          n.type !== 'section' &&
          n.x >= section.x &&
          n.y >= section.y &&
          n.x + n.w <= section.x + section.w &&
          n.y + n.h <= section.y + section.h,
      )
      .map((n) => n.id);
  }
  function move(nodes, ids, dx, dy, snap = false) {
    const chosen = nodes.filter((n) => ids.includes(n.id));
    if (!chosen.length) return;
    let x = dx,
      y = dy;
    if (snap) {
      x = Math.round((chosen[0].x + dx) / 20) * 20 - chosen[0].x;
      y = Math.round((chosen[0].y + dy) / 20) * 20 - chosen[0].y;
    }
    for (const n of chosen) {
      x = Math.max(-10000 - n.x, Math.min(10000 - n.x, x));
      y = Math.max(-10000 - n.y, Math.min(10000 - n.y, y));
    }
    for (const n of chosen) {
      n.x += x;
      n.y += y;
    }
  }
  function fit(nodes, width, height) {
    if (!nodes.length) return { x: 40, y: 40, zoom: 1 };
    const minX = Math.min(...nodes.map((n) => n.x)),
      minY = Math.min(...nodes.map((n) => n.y)),
      maxX = Math.max(...nodes.map((n) => n.x + n.w)),
      maxY = Math.max(...nodes.map((n) => n.y + n.h));
    const z = clamp(
      Math.min((width - 80) / (maxX - minX), (height - 80) / (maxY - minY)),
      0.3,
      1.2,
      1,
    );
    return {
      zoom: z,
      x: width / 2 - ((minX + maxX) / 2) * z,
      y: height / 2 - ((minY + maxY) / 2) * z,
    };
  }
  const api = { tools, normalize, toWorld, zoomAt, members, move, fit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FleremahiasBoardCore = api;
})(typeof window === 'undefined' ? globalThis : window);
