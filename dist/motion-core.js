(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FleremahiasMotionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const presets = [
    {
      id: 'kinetic',
      name: 'Tipografía cinética',
      kind: '2D',
      note: 'Título, ritmo y llamada a la acción.',
    },
    {
      id: 'product',
      name: 'Lanzamiento de producto',
      kind: '2D',
      note: 'Tarjeta editorial animada para tu oferta.',
    },
    {
      id: 'stories',
      name: 'Historia en tres actos',
      kind: '2D',
      note: 'Tres mensajes en una pieza social.',
    },
    {
      id: 'product3d',
      name: 'Producto orbital',
      kind: '3D',
      note: 'Objeto tridimensional con luz y cámara.',
    },
    {
      id: 'orbit3d',
      name: 'Escultura de marca',
      kind: '3D',
      note: 'Geometría, órbitas y movimiento por fotograma.',
    },
    {
      id: 'data3d',
      name: 'Datos en perspectiva',
      kind: '3D',
      note: 'Barras animadas en un espacio 3D real.',
    },
  ];
  const clamp = (v, a, b, d) =>
    Number.isFinite(Number(v)) ? Math.max(a, Math.min(b, Number(v))) : d;
  const text = (v, d, n = 300) => (typeof v === 'string' ? v.slice(0, n) : d);
  function normalize(value = {}) {
    const format = ['9:16', '1:1', '16:9', '4:5'].includes(value.format) ? value.format : '9:16';
    return {
      preset: presets.some((p) => p.id === value.preset) ? value.preset : 'kinetic',
      format,
      quality: [720, 1080, 2160].includes(+value.quality) ? +value.quality : 720,
      fps: [24, 30, 60].includes(+value.fps) ? +value.fps : 30,
      duration: clamp(value.duration, 1, 30, 6),
      title: text(value.title, 'Crea con tu firma.', 160),
      subtitle: text(value.subtitle, 'Una idea. Muchas posibilidades.'),
      cta: text(value.cta, 'Hazlo tuyo.', 100),
      accent: /^#[a-f0-9]{6}$/i.test(value.accent) ? value.accent : '#9aefc4',
      background: /^#[a-f0-9]{6}$/i.test(value.background) ? value.background : '#0b1310',
      sound: ['off', 'pulse', 'ambient'].includes(value.sound) ? value.sound : 'off',
      code: text(value.code, '', 100000),
    };
  }
  function config(value) {
    const v = normalize(value),
      q = v.quality;
    const [width, height] =
      v.format === '16:9'
        ? [(q * 16) / 9, q]
        : v.format === '1:1'
          ? [q, q]
          : v.format === '4:5'
            ? [q, (q * 5) / 4]
            : [q, (q * 16) / 9];
    const even = (n) => Math.round(n / 2) * 2;
    return {
      id: 'FleremahiasMotion',
      width: even(width),
      height: even(height),
      fps: v.fps,
      durationInFrames: Math.max(1, Math.round(v.duration * v.fps)),
    };
  }
  function serialize(value) {
    return JSON.stringify(
      { studio: 'Fleremahias Motion', version: 1, draft: normalize(value) },
      null,
      2,
    );
  }
  function parse(source) {
    if (typeof source !== 'string' || source.length > 130000)
      throw Error('Proyecto Motion demasiado grande.');
    const data = JSON.parse(source);
    if (data.studio !== 'Fleremahias Motion' || data.version !== 1 || !data.draft)
      throw Error('Este archivo no es un proyecto Motion compatible.');
    return normalize(data.draft);
  }
  function score(duration, mode = 'pulse') {
    const rate = 24000,
      count = Math.ceil(Math.max(1, Math.min(30, duration)) * rate);
    const data = new ArrayBuffer(44 + count * 2),
      view = new DataView(data);
    const put = (offset, string) =>
      [...string].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    put(0, 'RIFF');
    view.setUint32(4, 36 + count * 2, true);
    put(8, 'WAVE');
    put(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    put(36, 'data');
    view.setUint32(40, count * 2, true);
    for (let i = 0; i < count; i++) {
      const t = i / rate,
        beat = t % 0.5,
        bar = Math.floor(t / 2) % 4;
      const tone = [130.81, 164.81, 196, 146.83][bar];
      const music =
        (Math.sin(t * 2 * Math.PI * tone) + 0.35 * Math.sin(t * 2 * Math.PI * tone * 1.5)) * 0.055;
      const hit =
        mode === 'pulse'
          ? Math.sin(2 * Math.PI * (90 * beat + 100 * beat * beat)) * Math.exp(-beat * 25) * 0.18
          : 0;
      const env = Math.min(1, t / 0.05, (count / rate - t) / 0.2);
      view.setInt16(
        44 + i * 2,
        Math.round(Math.max(-1, Math.min(1, (music + hit) * Math.max(0, env))) * 32767),
        true,
      );
    }
    return data;
  }
  return { presets, normalize, config, serialize, parse, score };
});
