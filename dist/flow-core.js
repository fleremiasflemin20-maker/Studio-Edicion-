/* Pure workflow operations. No UI or network dependencies. */
(function (root) {
  const P = root.LumaCreatorCore || require('./creator-core.js'),
    C = root.LumaCore || require('./core.js');
  function toSRT(blocks) {
    return blocks
      .map((b, i) => `${i + 1}\n${C.stamp(b.start)} --> ${C.stamp(b.end)}\n${b.text}`)
      .join('\n\n');
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  function csv(text) {
    text = String(text).replace(/^\uFEFF/, '');
    if (text.length > 1000000) throw Error('Tabla demasiado grande');
    const delimiter = text.split('\n')[0].includes('\t')
      ? '\t'
      : text.split('\n')[0].includes(';')
        ? ';'
        : ',';
    const rows = [];
    let row = [],
      field = '',
      quoted = false;
    for (let i = 0; i <= text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = !quoted;
      } else if (!quoted && (c === delimiter || c === '\n' || c === undefined)) {
        row.push(field.trim());
        field = '';
        if (c !== delimiter) {
          if (row.some(Boolean)) rows.push(row);
          row = [];
        }
      } else if (c !== '\r') field += c;
    }
    if (quoted) throw Error('Hay comillas sin cerrar');
    if (rows.length < 2) throw Error('Añade cabecera y al menos una fila');
    if (rows.length > 51) throw Error('Máximo 50 filas');
    const headers = rows.shift().map((h) => h.toLowerCase());
    if (new Set(headers).size !== headers.length || headers.some((h) => !h))
      throw Error('Las cabeceras deben ser únicas y no vacías');
    return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
  }
  function fill(text, row) {
    return String(text).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, k) => row[k.toLowerCase()] ?? '');
  }
  function silence(samples, rate, threshold = 0.018, min = 0.5) {
    const step = Math.max(1, Math.floor(rate * 0.02)),
      ranges = [];
    let start = null;
    for (let i = 0; i < samples.length; i += step) {
      let energy = 0;
      for (let j = i; j < Math.min(i + step, samples.length); j++) energy += samples[j] ** 2;
      const quiet = Math.sqrt(energy / Math.min(step, samples.length - i)) < threshold;
      if (quiet && start === null) start = i / rate;
      if ((!quiet || i + step >= samples.length) && start !== null) {
        const end = Math.min(samples.length, i + (quiet ? step : 0)) / rate;
        if (end - start >= min)
          ranges.push({ start: start + 0.08, end: Math.max(start + 0.08, end - 0.08) });
        start = null;
      }
    }
    return ranges.filter((r) => r.end > r.start);
  }
  function beats(samples, rate) {
    const hop = Math.max(1, Math.floor(rate * 0.025)),
      energy = [];
    for (let i = 0; i < samples.length; i += hop) {
      let s = 0;
      for (let j = i; j < Math.min(i + hop, samples.length); j++) s += samples[j] ** 2;
      energy.push(Math.sqrt(s / hop));
    }
    const peaks = [];
    for (let i = 2; i < energy.length - 2; i++) {
      const local = energy.slice(Math.max(0, i - 20), i),
        avg = local.reduce((a, b) => a + b, 0) / Math.max(1, local.length);
      if (
        energy[i] > 0.02 &&
        energy[i] > avg * 1.45 &&
        energy[i] >= energy[i - 1] &&
        energy[i] > energy[i + 1] &&
        (!peaks.length || (i * hop) / rate - peaks.at(-1) > 0.22)
      )
        peaks.push((i * hop) / rate);
    }
    return peaks;
  }
  function keepRanges(duration, removed) {
    let cursor = 0,
      out = [];
    for (const r of removed.slice().sort((a, b) => a.start - b.start)) {
      const a = clamp(r.start, 0, duration),
        b = clamp(r.end, a, duration);
      if (a > cursor + 0.08) out.push({ start: cursor, end: a });
      cursor = Math.max(cursor, b);
    }
    if (duration > cursor + 0.08) out.push({ start: cursor, end: duration });
    return out;
  }
  function slice(scene, start, end) {
    const length = P.length(scene);
    start = clamp(start, 0, length);
    end = clamp(end, start, length);
    if (end - start < 0.08) throw Error('Fragmento demasiado corto');
    const s = P.scene(scene),
      speed = scene.speed || 1;
    s.start = (scene.start || 0) + start * speed;
    s.end = (scene.start || 0) + end * speed;
    s.duration = end - start;
    s.layers = (scene.layers || [])
      .filter((l) => !l.endAt || l.endAt > start)
      .filter((l) => (l.startAt || 0) < end)
      .map((l) => ({
        ...P.layer(l),
        startAt: Math.max(0, (l.startAt || 0) - start),
        endAt: l.endAt ? Math.min(end - start, l.endAt - start) : 0,
        sourceStart: (l.sourceStart || 0) + Math.max(0, start - (l.startAt || 0)) * (l.speed || 1),
      }));
    const blocks = C.parseSRT(scene.subtitles || '')
      .filter((b) => b.end > start && b.start < end)
      .map((b) => ({
        ...b,
        start: Math.max(0, b.start - start),
        end: Math.min(end - start, b.end - start),
      }));
    s.subtitles = toSRT(blocks);
    s.words = (scene.words || [])
      .filter((w) => w.end > start && w.start < end)
      .map((w) => ({
        ...w,
        start: Math.max(0, w.start - start),
        end: Math.min(end - start, w.end - start),
      }));
    s.facePath = (scene.facePath || [])
      .filter((k) => k.t >= start && k.t <= end)
      .map((k) => ({ ...k, t: k.t - start }));
    return s;
  }
  function safe(scene, platform = 'reels') {
    const bounds =
      platform === 'tiktok'
        ? { left: 10, right: 78, top: 14, bottom: 70 }
        : { left: 10, right: 84, top: 14, bottom: 74 };
    scene.textX = clamp(scene.textX, bounds.left + 20, bounds.right - 20);
    scene.textY = clamp(scene.textY, bounds.top + 8, bounds.bottom - 8);
    scene.fontSize = Math.min(scene.fontSize, 85);
    for (const l of scene.layers || []) {
      if (l.kind === 'image' || l.kind === 'video') continue;
      l.width = Math.min(l.width, bounds.right - bounds.left);
      l.x = clamp(l.x, bounds.left + l.width / 2, bounds.right - l.width / 2);
      l.y = clamp(l.y, bounds.top + 8, bounds.bottom - 8);
      l.size = Math.min(l.size, 90);
    }
    scene.safePlatform = platform;
    scene.subtitleY = platform === 'tiktok' ? 64 : 68;
    return scene;
  }
  function wordsToSrt(words) {
    const groups = [];
    for (let i = 0; i < words.length; i += 5) {
      const chunk = words.slice(i, i + 5);
      groups.push({
        start: chunk[0].start,
        end: chunk.at(-1).end,
        text: chunk.map((w) => w.text).join(' '),
      });
    }
    return toSRT(groups);
  }
  function normalizeWords(words, duration = 86400) {
    return (Array.isArray(words) ? words : [])
      .slice(0, 20000)
      .map((w) => ({
        text: String(w.text || '')
          .trim()
          .slice(0, 100),
        start: clamp(w.start, 0, duration),
        end: clamp(w.end, 0, duration),
      }))
      .filter((w) => w.text && w.end > w.start)
      .sort((a, b) => a.start - b.start);
  }
  function candidates(words, maxDuration = 45) {
    const out = [];
    let start = 0;
    while (start < words.length && out.length < 12) {
      let end = start;
      while (end + 1 < words.length && words[end + 1].end - words[start].start < maxDuration) {
        end++;
        if (
          end - start > 12 &&
          /[.!?]$/.test(words[end].text) &&
          words[end].end - words[start].start > 12
        )
          break;
      }
      const group = words.slice(start, end + 1);
      if (group.length >= 3)
        out.push({
          start: group[0].start,
          end: group.at(-1).end,
          text: group.map((w) => w.text).join(' '),
          reason: 'Bloque de transcripción; corte por duración y puntuación. Revisa el contexto.',
        });
      start = end + 1;
    }
    return out;
  }
  const recipes = [
    {
      id: 'tutorial',
      name: 'Tutorial claro',
      titleStyle: 'outline',
      subtitleStyle: 'karaoke',
      filter: 'original',
      transition: 'cut',
      bg: '#222033',
      color: '#ffffff',
    },
    {
      id: 'product',
      name: 'Producto y oferta',
      titleStyle: 'poster',
      subtitleStyle: 'pill',
      filter: 'crisp',
      transition: 'zoom',
      bg: '#38214c',
      color: '#ffe168',
    },
    {
      id: 'podcast',
      name: 'Podcast editorial',
      titleStyle: 'editorial',
      subtitleStyle: 'dark',
      filter: 'documentary',
      transition: 'cut',
      bg: '#29372f',
      color: '#f4e8d5',
    },
    {
      id: 'vlog',
      name: 'Vlog luminoso',
      titleStyle: 'minimal',
      subtitleStyle: 'mint',
      filter: 'peach',
      transition: 'fade',
      bg: '#f0e8d9',
      color: '#36383c',
    },
    {
      id: 'ad',
      name: 'Anuncio directo',
      titleStyle: 'boxed',
      subtitleStyle: 'yellow',
      filter: 'vibrant',
      transition: 'slide',
      bg: '#7658df',
      color: '#ffffff',
    },
  ];
  function applyRecipe(scene, recipe) {
    for (const k of [
      'titleStyle',
      'subtitleStyle',
      'filter',
      'transition',
      'bg',
      'color',
      'font',
      'fontSize',
      'background',
    ])
      if (recipe[k] !== undefined) scene[k] = recipe[k];
    return scene;
  }
  function interpolate(path, time, fallback = 50) {
    if (!path?.length) return fallback;
    const b = path.findIndex((k) => k.t >= time);
    if (b < 0) return path.at(-1).x;
    if (!b) return path[0].x;
    const a = path[b - 1],
      c = path[b];
    return a.x + (c.x - a.x) * clamp((time - a.t) / (c.t - a.t), 0, 1);
  }
  const api = {
    csv,
    fill,
    silence,
    beats,
    keepRanges,
    slice,
    safe,
    wordsToSrt,
    normalizeWords,
    candidates,
    recipes,
    applyRecipe,
    interpolate,
  };
  root.LumaFlowCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
