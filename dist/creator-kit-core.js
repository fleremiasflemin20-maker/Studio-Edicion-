(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FleremahiasCreatorKit = api;
})(globalThis, function (root) {
  'use strict';
  const n = (v, a, b, d) => (Number.isFinite(+v) ? Math.max(a, Math.min(b, +v)) : d);
  const hex = (v, f) => (/^#[a-f\d]{6}$/i.test(v) ? v : f);
  const sceneFields = [
    'filter',
    'filterStrength',
    'customFilter',
    'brightness',
    'saturation',
    'adjust',
    'background',
    'bg',
    'color',
    'font',
    'fontSize',
    'titleStyle',
    'subtitleStyle',
    'subtitleY',
    'transition',
    'motion',
    'zoom',
    'fit',
  ];
  const creator = () =>
    root.LumaCreatorCore || (typeof require === 'function' ? require('./creator-core.js') : null);
  const visualKinds = new Set(['text', 'shape', 'counter']);
  function safeSettings(value) {
    const input = { ...value };
    if (!input.adjust || typeof input.adjust !== 'object') input.adjust = {};
    const normalized = creator().scene(input);
    return Object.fromEntries(
      sceneFields
        .filter((k) => Object.hasOwn(value, k) && normalized[k] !== undefined)
        .map((k) => [k, structuredClone(normalized[k])]),
    );
  }
  function safeLayers(value) {
    return (Array.isArray(value) ? value : [])
      .filter((l) => l && typeof l === 'object' && visualKinds.has(l.kind))
      .slice(0, 12)
      .map((l) => ({ ...creator().layer(l), asset: null }));
  }
  function brand(v = {}) {
    if (!v || typeof v !== 'object') v = {};
    return {
      name: String(v.name || 'Mi marca').slice(0, 80),
      primary: hex(v.primary, '#9aefc4'),
      background: hex(v.background, '#0b1310'),
      text: hex(v.text, '#ffffff'),
      font: ['sans-serif', 'serif', 'monospace'].includes(v.font) ? v.font : 'sans-serif',
      titleStyle: String(v.titleStyle || 'clean').slice(0, 30),
      logo: typeof v.logo === 'string' ? v.logo.slice(0, 100) : null,
      closing: String(v.closing || '').slice(0, 160),
    };
  }
  function recipe(project, name) {
    const source = project.scenes?.find((s) => s.id === project.activeScene) || project;
    return {
      id: crypto.randomUUID(),
      name: String(name || 'Mi receta').slice(0, 80),
      version: 1,
      settings: safeSettings(source),
      format: project.format,
      musicVolume: n(project.musicVolume, 0, 1, 0.25),
      ducking: !!project.ducking,
      musicLoop: project.musicLoop !== false,
      quality: [720, 1080].includes(project.exportQuality) ? project.exportQuality : 720,
      layers: safeLayers(source.layers),
    };
  }
  function normalizeRecipe(value) {
    if (
      !value ||
      value.version !== 1 ||
      typeof value.name !== 'string' ||
      !value.settings ||
      typeof value.settings !== 'object' ||
      Array.isArray(value.settings)
    )
      throw Error('Receta no válida.');
    return {
      id: typeof value.id === 'string' ? value.id.slice(0, 100) : crypto.randomUUID(),
      name: value.name.slice(0, 80),
      version: 1,
      settings: safeSettings(value.settings),
      format: ['9:16', '16:9', '1:1', '4:5'].includes(value.format) ? value.format : '9:16',
      musicVolume: n(value.musicVolume, 0, 1, 0.25),
      ducking: !!value.ducking,
      musicLoop: value.musicLoop !== false,
      quality: [720, 1080].includes(value.quality) ? value.quality : 720,
      layers: safeLayers(value.layers),
    };
  }
  function applyRecipe(project, value, normalizeScene, normalizeLayer) {
    const r = normalizeRecipe(value);
    for (const scene of project.scenes) {
      const normalized = normalizeScene({ ...scene, ...r.settings });
      for (const key of sceneFields)
        if (normalized[key] !== undefined) scene[key] = structuredClone(normalized[key]);
      if (r.layers.length)
        scene.layers = [...scene.layers, ...r.layers.map(normalizeLayer)].slice(0, 40);
    }
    project.musicVolume = r.musicVolume;
    project.ducking = r.ducking;
    project.musicLoop = r.musicLoop;
    project.exportQuality = r.quality;
    return project;
  }
  function waveform(samples, bins = 120) {
    if (!samples?.length) return [];
    const size = Math.max(1, Math.min(2048, Math.floor(n(bins, 1, 2048, 120)))),
      out = [];
    for (let i = 0; i < size; i++) {
      let sum = 0,
        count = 0,
        peak = 0;
      for (
        let j = Math.floor((i * samples.length) / size);
        j < Math.floor(((i + 1) * samples.length) / size);
        j++
      ) {
        const sample = Number.isFinite(samples[j]) ? samples[j] : 0;
        peak = Math.max(peak, Math.abs(sample));
        sum += sample ** 2;
        count++;
      }
      out.push({ rms: Math.sqrt(sum / Math.max(1, count)), peak });
    }
    return out;
  }
  function sentences(words) {
    const groups = [];
    let group = [];
    const valid = (Array.isArray(words) ? words : [])
      .filter(
        (w) =>
          w &&
          Number.isFinite(+w.start) &&
          Number.isFinite(+w.end) &&
          +w.start >= 0 &&
          +w.end > +w.start,
      )
      .map((w) => ({ start: +w.start, end: +w.end, text: String(w.text || '').slice(0, 100) }))
      .filter((w) => w.text.trim())
      .sort((a, b) => a.start - b.start || a.end - b.end);
    for (const word of valid) {
      if (group.length && (word.start - group[0].start > 8 || word.start - group.at(-1).end > 1)) {
        groups.push(group);
        group = [];
      }
      group.push(word);
      if (/[.!?…]$/.test(word.text) || group.length >= 24) {
        groups.push(group);
        group = [];
      }
    }
    if (group.length) groups.push(group);
    return groups.map((words, i) => ({
      id: i,
      words,
      start: words[0].start,
      end: Math.max(...words.map((w) => w.end)),
      text: words.map((w) => w.text).join(' '),
    }));
  }
  function reorder(groups, order) {
    const ids = new Set();
    return order.map((id) => {
      const item = groups.find((g) => g.id === +id);
      if (!item || ids.has(item.id)) throw Error('Orden de frases no válido.');
      ids.add(item.id);
      return item;
    });
  }
  function manifest(project) {
    const created =
        typeof project.created === 'string' ? Date.parse(project.created) : Number(project.created),
      date = Number.isFinite(created) ? new Date(created) : new Date(0);
    return {
      studio: 'Fleremahias Studio',
      version: 1,
      title: String(project.name || ''),
      caption: String(project.caption || ''),
      format: project.format,
      platform: project.platform,
      scenes: (project.scenes || []).map((s) => {
        const start = Number.isFinite(+s.start) ? +s.start : 0,
          source = +s.end || +s.sourceDuration,
          hasSource = !!s.asset && Number.isFinite(source) && source > 0,
          speed = n(s.speed, 0.25, 3, 1);
        return {
          name: String(s.name || ''),
          duration: Math.max(0, hasSource ? (source - start) / speed : n(s.duration, 0, 120, 0)),
        };
      }),
      created: Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString(),
    };
  }

  function editWords(words, edits = []) {
    if (!Array.isArray(words) || words.length > 20000) throw Error('Invalid timed words');
    const ranges = [];
    let active = null;
    words.forEach((word, index) => {
      const edit = edits[index] || {},
        keep = edit.keep !== false && String(edit.text ?? word.text).trim();
      if (!keep) {
        active = null;
        return;
      }
      const start = +word.start,
        end = +word.end;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        throw Error('Invalid word timing');
      const tokens = String(edit.text ?? word.text)
        .trim()
        .split(/\s+/)
        .slice(0, 20);
      if (!active || start - active.end > 0.8) {
        active = { start, end, words: [], text: '' };
        ranges.push(active);
      }
      tokens.forEach((text, n) =>
        active.words.push({
          text: text.slice(0, 100),
          start: start + ((end - start) * n) / tokens.length,
          end: start + ((end - start) * (n + 1)) / tokens.length,
        }),
      );
      active.end = end;
      active.text = active.words.map((w) => w.text).join(' ');
    });
    return ranges;
  }

  return {
    editWords,
    brand,
    recipe,
    normalizeRecipe,
    applyRecipe,
    waveform,
    sentences,
    reorder,
    manifest,
    sceneFields,
  };
});
