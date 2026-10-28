(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FleremahiasMotionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const presets = [
    {
      id: 'photo-motion',
      name: 'Foto en movimiento',
      kind: '2D',
      note: 'Anima una imagen de tu biblioteca con encuadre y título.',
    },
    {
      id: 'audiogram',
      name: 'Audio visual',
      kind: '2D',
      note: 'Tu audio real con forma de onda sincronizada.',
    },
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
      imageAsset: typeof value.imageAsset === 'string' ? value.imageAsset.slice(0, 100) : '',
      audioAsset: typeof value.audioAsset === 'string' ? value.audioAsset.slice(0, 100) : '',
      audioStart: clamp(value.audioStart, 0, 86400, 0),
      values: normalizeValues(value.values),
    };
  }
  function normalizeValues(value) {
    const incoming = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(/[,;\s]+/)
        : [];
    const numbers = incoming
      .filter((x) => x !== '' && Number.isFinite(Number(x)))
      .slice(0, 8)
      .map((x) => clamp(x, 0, 1000000000, 0));
    return numbers.length ? numbers : [12, 24, 18, 32];
  }
  function waveform(samples, bins = 180) {
    const count = Math.max(1, Math.min(4096, Math.floor(bins) || 180)),
      out = [];
    for (let b = 0; b < count; b++) {
      const start = Math.floor((b * samples.length) / count),
        end = Math.max(start + 1, Math.floor(((b + 1) * samples.length) / count));
      let power = 0,
        n = 0;
      for (let i = start; i < Math.min(end, samples.length); i++) {
        const v = Number.isFinite(samples[i]) ? samples[i] : 0;
        power += v * v;
        n++;
      }
      out.push(n ? Math.sqrt(power / n) : 0);
    }
    const peak = Math.max(0.0001, ...out);
    return out.map((v) => Math.max(0, Math.min(1, v / peak)));
  }
  function pcmWav(samples, rate = 16000) {
    if (
      !samples ||
      samples.length > 30 * 48000 ||
      ![8000, 16000, 24000, 44100, 48000].includes(rate)
    )
      throw Error('Audio must be mono PCM and at most 30 seconds.');
    if (samples.length / rate > 30.001) throw Error('Audio must be at most 30 seconds.');
    const data = new ArrayBuffer(44 + samples.length * 2),
      v = new DataView(data);
    const put = (p, s) => [...s].forEach((c, i) => v.setUint8(p + i, c.charCodeAt(0)));
    put(0, 'RIFF');
    v.setUint32(4, 36 + samples.length * 2, true);
    put(8, 'WAVEfmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    put(36, 'data');
    v.setUint32(40, samples.length * 2, true);
    samples.forEach((n, i) =>
      v.setInt16(
        44 + i * 2,
        Math.round(Math.max(-1, Math.min(1, Number.isFinite(n) ? n : 0)) * 32767),
        true,
      ),
    );
    return data;
  }
  function clipAudio(samples, rate, start = 0, duration = 6) {
    if (!samples || !Number.isFinite(rate) || rate < 8000 || rate > 48000)
      throw Error('Invalid decoded audio.');
    const begin = Math.floor(clamp(start, 0, 86400, 0) * rate),
      end = Math.min(samples.length, begin + Math.floor(clamp(duration, 1, 30, 6) * rate));
    if (end <= begin) throw Error('Audio start is beyond the file duration.');
    const selected = samples.slice(begin, end),
      actualDuration = selected.length / rate;
    return {
      wav: pcmWav(selected, rate),
      duration: actualDuration,
      waveform: waveform(selected, Math.ceil(actualDuration * 60)),
    };
  }
  function validateMedia(value = {}) {
    const checked = { imageData: '', audioData: '', waveform: [], audioDuration: 0 };
    for (const [key, pattern] of [
      ['imageData', /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/],
      ['audioData', /^data:audio\/wav;base64,[A-Za-z0-9+/]+={0,2}$/],
    ]) {
      if (value[key]) {
        if (
          typeof value[key] !== 'string' ||
          value[key].length > 40 * 1024 * 1024 ||
          !pattern.test(value[key])
        )
          throw Error('Motion media must be a bounded image or PCM WAV data URL.');
        checked[key] = value[key];
      }
    }
    if (Array.isArray(value.waveform)) {
      if (
        value.waveform.length > 4096 ||
        !value.waveform.every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
      )
        throw Error('Invalid waveform data.');
      checked.waveform = value.waveform.slice();
    }
    checked.audioDuration = clamp(value.audioDuration, 0, 30, 0);
    return checked;
  }
  function references(value) {
    const d = normalize(value);
    return [...new Set([d.imageAsset, d.audioAsset].filter(Boolean))];
  }
  function remap(value, mapping) {
    const d = normalize(value);
    for (const key of ['imageAsset', 'audioAsset']) if (d[key]) d[key] = mapping.get(d[key]) || '';
    return d;
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
  return {
    presets,
    normalize,
    config,
    serialize,
    parse,
    score,
    normalizeValues,
    waveform,
    pcmWav,
    clipAudio,
    validateMedia,
    references,
    remap,
  };
});
