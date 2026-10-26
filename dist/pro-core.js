/**
 * Pure presets and editing operations. No DOM, network or application state.
 * Shared by the editor controller and the automated tests.
 */
(function (root) {
  const creator = root.LumaCreatorCore || require('./creator-core.js');
  const base = root.LumaCore || require('./core.js');
  const textStyles = [
    ['clean', 'Limpio', '#ffffff', '#40324f'],
    ['outline', 'Contorno', '#ffffff', '#111827'],
    ['neon', 'Neón', '#91ffde', '#222139'],
    ['boxed', 'Caja de color', '#ffffff', '#7658df'],
    ['highlight', 'Resaltador', '#242424', '#f9dc67'],
    ['shadow', 'Sombra larga', '#ffffff', '#dd929d'],
    ['editorial', 'Editorial', '#f4e8d5', '#444d42'],
    ['mono', 'Técnico', '#b7e6d5', '#202b32'],
    ['comic', 'Cómic', '#ffe168', '#7655aa'],
    ['glass', 'Tarjeta suave', '#ffffff', '#6d8497'],
    ['gradient', 'Degradado', '#d9acff', '#2b2344'],
    ['label', 'Etiqueta', '#ffffff', '#33333c'],
    ['subtitle', 'Subtítulo', '#ffffff', '#18181b'],
    ['poster', 'Impacto', '#ffdf72', '#28252e'],
    ['minimal', 'Minimal', '#36383c', '#ede5d7'],
    ['stamp', 'Sello', '#ffffff', '#b76162'],
  ].map(([id, name, color, fill]) => ({ id, name, color, fill }));
  const extraFilters = [
    ['peach', 'Melocotón', 'sepia(.18) saturate(1.12) brightness(1.05)', '#e7b6a0'],
    ['teal', 'Teal', 'hue-rotate(15deg) contrast(1.1) saturate(.8)', '#6b9c99'],
    ['rose', 'Rosa', 'sepia(.12) saturate(.9)', '#c89aaf', '#e886b5', 0.1],
    ['forest', 'Bosque', 'contrast(1.15) saturate(.78)', '#7b9075', '#315b31', 0.08],
    ['ocean', 'Océano', 'contrast(1.08) saturate(1.18)', '#6f9fb4', '#287bbb', 0.08],
    ['gold', 'Dorado', 'sepia(.35) brightness(1.06)', '#c7ad73'],
    ['frost', 'Escarcha', 'saturate(.65) brightness(1.12)', '#c5d5dc'],
    ['copper', 'Cobre', 'sepia(.5) contrast(1.12)', '#ad8066'],
    ['documentary', 'Documental', 'saturate(.65) contrast(1.2)', '#7f8887'],
    ['pastel', 'Pastel', 'contrast(.85) saturate(.78) brightness(1.14)', '#d6bbd2'],
    ['crisp', 'Nítido', 'contrast(1.3) saturate(1.1)', '#7d96aa'],
    ['silhouette', 'Silueta', 'grayscale(1) contrast(2) brightness(.65)', '#43404a'],
  ].map(([id, name, css, swatch, overlay, alpha]) => ({ id, name, css, swatch, overlay, alpha }));
  const compositions = [
    {
      id: 'hook',
      name: 'Gancho + contexto',
      icon: 'Aa',
      layers: [
        { text: 'Lo que nadie te cuenta', y: 36, size: 94, style: 'outline', animation: 'pop' },
        {
          text: 'Una idea que vale la pena guardar.',
          y: 58,
          size: 42,
          style: 'boxed',
          animation: 'slide',
        },
      ],
    },
    {
      id: 'lowerthird',
      name: 'Nombre de presentador',
      icon: '▱',
      layers: [
        { kind: 'shape', x: 45, y: 77, width: 76, height: 15, fill: '#262338' },
        { text: 'Tu nombre', x: 45, y: 75, size: 56, style: 'clean', animation: 'slide' },
        {
          text: 'Creador · Tu especialidad',
          x: 45,
          y: 81,
          size: 29,
          style: 'clean',
          animation: 'fade',
        },
      ],
    },
    {
      id: 'sale',
      name: 'Oferta lista',
      icon: '%',
      layers: [
        { text: 'SOLO POR HOY', y: 28, size: 38, style: 'label' },
        { text: '-30%', y: 46, size: 190, style: 'poster', animation: 'pop' },
        { text: 'Descubre la colección', y: 70, size: 50, style: 'boxed' },
      ],
    },
    {
      id: 'quote',
      name: 'Cita editorial',
      icon: '“',
      layers: [
        { text: '“Tu voz también\nmerece ser escuchada.”', y: 45, size: 80, style: 'editorial' },
        { text: '— Tu nombre', y: 68, size: 34, style: 'editorial' },
      ],
    },
    {
      id: 'subscribe',
      name: 'Suscríbete',
      icon: '↗',
      layers: [
        { text: '¿Te sirvió esta idea?', y: 38, size: 64, style: 'clean' },
        { text: 'SUSCRÍBETE', y: 58, size: 84, style: 'boxed', animation: 'pop' },
        { text: 'Más contenido cada semana', y: 73, size: 32, style: 'clean' },
      ],
    },
    {
      id: 'podcast',
      name: 'Frase de podcast',
      icon: '♫',
      layers: [
        { text: 'HABLEMOS DE ESTO', y: 24, size: 32, style: 'label' },
        { text: 'Una conversación\nque cambia tu perspectiva.', y: 48, size: 76, style: 'outline' },
        { text: 'EPISODIO 01 · TU PODCAST', y: 78, size: 28, style: 'mono' },
      ],
    },
    {
      id: 'price',
      name: 'Precio + beneficio',
      icon: '$',
      layers: [
        { text: 'TU PRODUCTO', y: 30, size: 48, style: 'minimal' },
        { text: '$29', y: 49, size: 160, style: 'shadow' },
        { text: 'Más simple. Más tuyo.', y: 72, size: 42, style: 'boxed' },
      ],
    },
    {
      id: 'location',
      name: 'Ubicación',
      icon: '⌖',
      layers: [
        { text: 'DESDE AQUÍ', y: 28, size: 32, style: 'label' },
        { text: 'Tu ciudad', y: 45, size: 104, style: 'editorial' },
        { text: 'Un lugar. Muchas historias.', y: 65, size: 38, style: 'clean' },
      ],
    },
    {
      id: 'announcement',
      name: 'Novedad',
      icon: '✦',
      layers: [
        { text: 'NUEVO', y: 27, size: 42, style: 'stamp', animation: 'pop' },
        { text: 'Tenemos algo\npara contarte.', y: 49, size: 90, style: 'gradient' },
        { text: 'Muy pronto · Tu marca', y: 77, size: 32, style: 'clean' },
      ],
    },
    {
      id: 'checklist',
      name: 'Lista de tres',
      icon: '✓',
      layers: [
        { text: 'GUÁRDALO PARA DESPUÉS', y: 22, size: 30, style: 'label' },
        {
          text: '01  Una idea clara\n02  Un ejemplo real\n03  Una acción sencilla',
          y: 51,
          size: 55,
          style: 'boxed',
        },
        { text: 'Tu próxima creación empieza aquí.', y: 80, size: 29, style: 'clean' },
      ],
    },
    {
      id: 'countdown',
      name: 'Cuenta atrás real',
      icon: '3',
      layers: [
        { text: 'ESTAMOS POR EMPEZAR', y: 28, size: 34, style: 'label' },
        { kind: 'counter', text: '{n}', y: 51, size: 210, style: 'neon' },
        { text: 'Quédate hasta el final', y: 78, size: 34, style: 'clean' },
      ],
    },
    {
      id: 'progress',
      name: 'Barra de progreso',
      icon: '━',
      layers: [
        {
          kind: 'shape',
          shape: 'progress',
          y: 88,
          width: 80,
          height: 2,
          fill: '#b7a0e6',
          progress: 100,
        },
        { text: 'Un paso más cerca.', y: 76, size: 38, style: 'clean' },
      ],
    },
  ];
  const extraSceneKeys = [
    'speed',
    'motion',
    'rotation',
    'flipX',
    'flipY',
    'titleStyle',
    'filterStrength',
    'adjust',
    'background',
  ];
  const layerKeys = ['style', 'startAt', 'endAt', 'animationDuration', 'shape', 'progress'];
  function clipCaptions(text, start, end) {
    return base
      .parseSRT(text || '')
      .map((c) => ({
        start: Math.max(0, c.start - start),
        end: Math.min(end, c.end) - start,
        text: c.text,
      }))
      .filter((c) => c.end > c.start)
      .map(
        (c, i) => i + 1 + '\n' + base.stamp(c.start) + ' --> ' + base.stamp(c.end) + '\n' + c.text,
      )
      .join('\n\n');
  }
  function sliceLayers(layers, start, end, total) {
    return (layers || [])
      .map((l) => {
        const a = l.startAt || 0,
          b = l.endAt || total;
        if (b <= start || a >= end) return null;
        return { ...l, startAt: Math.max(0, a - start), endAt: Math.min(end, b) - start };
      })
      .filter(Boolean);
  }
  /** Split in output seconds; video trim points remain in source seconds. */
  function splitScene(scene, at) {
    const total = creator.length(scene);
    if (!Number.isFinite(at) || at < 0.1 || at > total - 0.1)
      throw Error('El corte debe dejar al menos 0,1 s a cada lado.');
    const isVideo = !!(scene.asset && (scene.sourceDuration || scene.end));
    const splitSource = scene.start + at * (scene.speed || 1);
    const left = creator.scene({
      ...scene,
      name: scene.name + ' · A',
      end: isVideo ? splitSource : 0,
      duration: isVideo ? scene.duration : at,
      subtitles: clipCaptions(scene.subtitles, 0, at),
      layers: sliceLayers(scene.layers, 0, at, total),
    });
    const right = creator.scene({
      ...scene,
      name: scene.name + ' · B',
      start: isVideo ? splitSource : 0,
      duration: isVideo ? scene.duration : total - at,
      subtitles: clipCaptions(scene.subtitles, at, total),
      layers: sliceLayers(scene.layers, at, total, total),
    });
    return [left, right];
  }
  function timedCaptions(text, duration, wordsPerBlock = 4) {
    if (!text.trim()) throw Error('Escribe el texto del guion primero.');
    const words = text.trim().split(/\s+/),
      blocks = [];
    const count = Math.round(creator.n(wordsPerBlock, 2, 10, 4));
    for (let i = 0; i < words.length; i += count) blocks.push(words.slice(i, i + count).join(' '));
    return base.captions(blocks.join('\n'), duration);
  }
  function beatDuration(bpm, beats = 4) {
    if (!Number.isFinite(+bpm) || +bpm < 40 || +bpm > 220)
      throw Error('El BPM debe estar entre 40 y 220.');
    return (60 / +bpm) * creator.n(beats, 1, 16, 4);
  }
  function fitToBeat(scene, bpm, beats) {
    const seconds = beatDuration(bpm, beats),
      copy = structuredClone(scene);
    if (copy.asset && (copy.sourceDuration || copy.end)) {
      const available = (copy.sourceDuration || copy.end) - copy.start;
      copy.end = copy.start + Math.min(available, seconds * (copy.speed || 1));
    } else copy.duration = seconds;
    return copy;
  }
  function luminance(hex) {
    const rgb = hex
      .replace('#', '')
      .match(/../g)
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  function audit(project, assets) {
    const errors = [],
      warnings = [],
      scenes = project.scenes || [project],
      ids = new Set(assets.map((a) => a.id));
    if (!scenes.length) errors.push('El proyecto no tiene escenas.');
    for (const id of creator.references(project))
      if (!ids.has(id)) errors.push('Hay un archivo que falta en la biblioteca.');
    let total = 0;
    scenes.forEach((s, i) => {
      const label = 'Escena ' + (i + 1),
        duration = creator.length(s);
      if (!(duration > 0)) errors.push(label + ': el recorte no tiene duración.');
      else total += duration;
      try {
        base.parseSRT(s.subtitles || '');
      } catch {
        errors.push(label + ': revisa los tiempos SRT.');
      }
      if ((s.layers || []).some((l) => (l.endAt && l.endAt <= l.startAt) || l.startAt >= duration))
        warnings.push(label + ': hay capas con tiempos fuera del fragmento.');
      if (/tu texto aqu[ií]|tu pr[oó]xima\s+gran historia/i.test(s.text || ''))
        warnings.push(label + ': todavía hay texto de ejemplo.');
      if (!s.asset) {
        const a = luminance(s.color || '#ffffff'),
          b = luminance(s.bg || '#222033');
        if ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) < 3)
          warnings.push(label + ': el título tiene poco contraste con el fondo.');
      }
    });
    if (total > 120) errors.push('El montaje supera el límite de 120 segundos.');
    if (!project.caption?.trim())
      warnings.push('Añade una descripción antes de preparar las publicaciones.');
    return {
      errors: [...new Set(errors)],
      warnings,
      total,
      score: Math.max(0, 100 - errors.length * 25 - warnings.length * 8),
    };
  }
  root.LumaProCore = {
    textStyles,
    extraFilters,
    compositions,
    extraSceneKeys,
    layerKeys,
    splitScene,
    timedCaptions,
    beatDuration,
    fitToBeat,
    audit,
  };
  if (typeof module !== 'undefined') module.exports = root.LumaProCore;
})(globalThis);
