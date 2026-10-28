/* Fleremahias editing primitives. Pure configuration; never executes imported code. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FleremahiasEditorKit = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  const n = (v, min, max, fallback) =>
    Number.isFinite(+v) ? Math.max(min, Math.min(max, +v)) : fallback;
  const color = (v, f) => (/^#[a-f0-9]{6}$/i.test(v) ? v : f);
  function normalizeLUT(v) {
    if (!v || typeof v !== 'object') return null;
    const size = +v.size;
    if (!Number.isInteger(size) || size < 2 || size > 33) return null;
    if (
      !Array.isArray(v.values) ||
      v.values.length !== size ** 3 * 3 ||
      !v.values.every((x) => Number.isFinite(+x) && +x >= 0 && +x <= 1)
    )
      return null;
    const min = Array.isArray(v.domainMin)
      ? v.domainMin.slice(0, 3).map((x) => n(x, -16, 16, 0))
      : [0, 0, 0];
    const max = Array.isArray(v.domainMax)
      ? v.domainMax.slice(0, 3).map((x) => n(x, -16, 16, 1))
      : [1, 1, 1];
    if (min.length !== 3 || max.length !== 3 || max.some((x, i) => x <= min[i])) return null;
    return {
      size,
      values: v.values.map(Number),
      domainMin: min,
      domainMax: max,
      title: String(v.title || 'Imported LUT').slice(0, 80),
    };
  }
  function normalizeFilter(v = {}) {
    if (!v || typeof v !== 'object') v = {};
    return {
      name: String(v.name || 'Mi filtro').slice(0, 80),
      timeOffset: n(v.timeOffset, 0, 86400, 0),
      exposure: n(v.exposure, -2, 2, 0),
      contrast: n(v.contrast, 50, 180, 100),
      saturation: n(v.saturation, 0, 200, 100),
      temperature: n(v.temperature, -100, 100, 0),
      gamma: n(v.gamma, 0.2, 3, 1),
      shadows: n(v.shadows, -100, 100, 0),
      highlights: n(v.highlights, -100, 100, 0),
      intensity: n(v.intensity, 0, 1, 1),
      texture: ['none', 'grain', 'paper', 'paint', 'ink', 'glow'].includes(v.texture)
        ? v.texture
        : 'none',
      textureStrength: n(v.textureStrength, 0, 1, 0.2),
      paintColor: color(v.paintColor, '#8de4ce'),
      seed: Math.round(n(v.seed, 0, 2147483647, 142)),
      motion: ['none', 'pulse', 'drift', 'paint-fall'].includes(v.motion) ? v.motion : 'none',
      lut: normalizeLUT(v.lut),
    };
  }
  function parseCube(source) {
    if (typeof source !== 'string' || source.length > 4000000)
      throw Error('LUT .cube exceeds 4 MB.');
    let size = 0,
      title = 'Imported LUT',
      domainMin = [0, 0, 0],
      domainMax = [1, 1, 1],
      values = [];
    for (const raw of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const line = raw.replace(/#.*/, '').trim();
      if (!line) continue;
      if (/^TITLE\b/.test(line)) {
        title = line.slice(5).trim().replace(/^"|"$/g, '').slice(0, 80);
        continue;
      }
      if (/^LUT_1D_SIZE\b/.test(line)) throw Error('Use a 3D .cube LUT, not a 1D LUT.');
      if (/^LUT_3D_SIZE\b/.test(line)) {
        if (size) throw Error('Duplicate LUT size.');
        size = Number(line.split(/\s+/)[1]);
        if (!Number.isInteger(size) || size < 2 || size > 33)
          throw Error('LUT size must be between 2 and 33.');
        continue;
      }
      if (/^DOMAIN_(MIN|MAX)\b/.test(line)) {
        const parts = line.split(/\s+/);
        const vector = parts.slice(1).map(Number);
        if (vector.length !== 3 || !vector.every(Number.isFinite))
          throw Error('Invalid LUT domain.');
        if (parts[0] === 'DOMAIN_MIN') domainMin = vector;
        else domainMax = vector;
        continue;
      }
      const vector = line.split(/\s+/).map(Number);
      if (vector.length !== 3 || !vector.every((x) => Number.isFinite(x) && x >= 0 && x <= 1))
        throw Error('Invalid LUT RGB row.');
      values.push(...vector);
      if (values.length > 33 ** 3 * 3) throw Error('LUT has too many rows.');
    }
    const lut = normalizeLUT({ size, title, domainMin, domainMax, values });
    if (!lut) throw Error('LUT dimensions, domain or row count do not match.');
    return lut;
  }
  function sampleLUT(lut, r, g, b) {
    const c = [r, g, b].map(
      (v, i) =>
        n((v - lut.domainMin[i]) / (lut.domainMax[i] - lut.domainMin[i]), 0, 1, 0) * (lut.size - 1),
    );
    const lo = c.map(Math.floor),
      hi = lo.map((x) => Math.min(lut.size - 1, x + 1)),
      fraction = c.map((v, i) => v - lo[i]),
      out = [0, 0, 0];
    for (let z = 0; z < 2; z++)
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++) {
          const weight =
            (x ? fraction[0] : 1 - fraction[0]) *
            (y ? fraction[1] : 1 - fraction[1]) *
            (z ? fraction[2] : 1 - fraction[2]);
          const index =
            3 *
            ((z ? hi[2] : lo[2]) * lut.size * lut.size +
              (y ? hi[1] : lo[1]) * lut.size +
              (x ? hi[0] : lo[0]));
          for (let k = 0; k < 3; k++) out[k] += lut.values[index + k] * weight;
        }
    return out;
  }
  function applyLUT(pixels, value, strength = 1) {
    const lut = normalizeLUT(value);
    if (!lut) throw Error('Invalid LUT.');
    strength = n(strength, 0, 1, 1);
    for (let i = 0; i < pixels.length; i += 4) {
      const rgb = sampleLUT(lut, pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255);
      for (let c = 0; c < 3; c++)
        pixels[i + c] = Math.round(pixels[i + c] * (1 - strength) + rgb[c] * 255 * strength);
    }
    return pixels;
  }
  function gradeRGB(rgb, value) {
    const f = value,
      original = rgb.slice();
    let c = rgb.map((v) => Math.max(0, v * 2 ** f.exposure));
    c = c.map((v) => ((v - 0.5) * f.contrast) / 100 + 0.5);
    const l = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    c = c.map((v) => l + ((v - l) * f.saturation) / 100);
    c[0] += f.temperature * 0.0008;
    c[2] -= f.temperature * 0.0008;
    c = c.map((v) => {
      const cl = n(v, 0, 1, 0);
      return n(
        Math.pow(cl, 1 / f.gamma) +
          (f.shadows / 100) * 0.25 * (1 - cl) ** 2 +
          (f.highlights / 100) * 0.25 * cl ** 2,
        0,
        1,
        0,
      );
    });
    if (f.lut) c = sampleLUT(f.lut, ...c);
    return c.map((v, i) => original[i] * (1 - f.intensity) + v * f.intensity);
  }
  function gradePixels(pixels, value) {
    const f = normalizeFilter(value);
    for (let i = 0; i < pixels.length; i += 4) {
      const rgb = gradeRGB([pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255], f);
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(rgb[c] * 255);
    }
    return pixels;
  }
  const ranges = {
    x: [0, 100, 50],
    y: [0, 100, 50],
    scale: [0.05, 8, 1],
    rotation: [-1080, 1080, 0],
    opacity: [0, 1, 1],
  };
  function normalizeKeyframes(value) {
    const map = new Map();
    for (const source of Array.isArray(value) ? value.slice(0, 120) : []) {
      if (!source || !Number.isFinite(+source.t)) continue;
      const t = n(source.t, 0, 120, 0),
        key = {
          ...(map.get(t) || {}),
          t,
          easing: ['linear', 'ease-in-out', 'hold'].includes(source.easing)
            ? source.easing
            : 'linear',
        };
      for (const field of Object.keys(ranges))
        if (source[field] !== undefined) key[field] = n(source[field], ...ranges[field]);
      map.set(t, key);
    }
    return [...map.values()].sort((a, b) => a.t - b.t);
  }
  function interpolateKeyframes(value, time, base = {}) {
    const keys = normalizeKeyframes(value),
      output = {};
    time = n(time, 0, 120, 0);
    for (const field of Object.keys(ranges)) {
      const channel = keys.filter((k) => k[field] !== undefined);
      output[field] = n(base[field], ...ranges[field]);
      if (!channel.length) continue;
      if (channel[0].t > 0) channel.unshift({ t: 0, [field]: output[field], easing: 'linear' });
      let left = channel[0],
        right = channel[channel.length - 1];
      if (time <= left.t) {
        output[field] = left[field];
        continue;
      }
      if (time >= right.t) {
        output[field] = right[field];
        continue;
      }
      for (let i = 1; i < channel.length; i++)
        if (channel[i].t >= time) {
          left = channel[i - 1];
          right = channel[i];
          break;
        }
      let progress = (time - left.t) / (right.t - left.t);
      if (left.easing === 'hold') progress = 0;
      else if (left.easing === 'ease-in-out') progress = progress * progress * (3 - 2 * progress);
      output[field] = left[field] + (right[field] - left[field]) * progress;
    }
    return output;
  }
  function fitText(text, width, height, options = {}) {
    const max = n(options.fontSize, 8, 500, 72),
      minimum = Math.min(max, n(options.minSize, 8, 500, 16)),
      lineHeight = n(options.lineHeight, 1, 2, 1.25);
    const measure = options.measure || ((line, size) => line.length * size * 0.56);
    const wrap = (size) => {
      const lines = [];
      for (const paragraph of String(text).split('\n')) {
        let line = '';
        for (const word of paragraph.split(/\s+/)) {
          if (line && measure(line + ' ' + word, size) > width) {
            lines.push(line);
            line = word;
          } else line += (line ? ' ' : '') + word;
        }
        lines.push(line);
      }
      return lines;
    };
    let size = max,
      lines = wrap(size);
    while (
      size > minimum &&
      (lines.length * size * lineHeight > height ||
        lines.some((line) => measure(line, size) > width))
    ) {
      size = Math.max(minimum, size - 1);
      lines = wrap(size);
    }
    return {
      size,
      lines,
      overflow:
        lines.length * size * lineHeight > height ||
        lines.some((line) => measure(line, size) > width),
    };
  }
  function safeBounds(platform = 'generic') {
    return platform === 'tiktok'
      ? { left: 8, right: 84, top: 10, bottom: 76 }
      : platform === 'reels'
        ? { left: 8, right: 88, top: 10, bottom: 78 }
        : { left: 6, right: 94, top: 6, bottom: 94 };
  }
  function layoutLayers(layers, options = {}) {
    const output = structuredClone(layers || []).slice(0, 40),
      direction = ['row', 'column', 'grid'].includes(options.direction)
        ? options.direction
        : 'column',
      margin = n(options.margin, 0, 20, 8),
      gap = n(options.gap, 0, 15, 4),
      count = output.length;
    if (!count) return output;
    const movable = output.filter((layer) => !layer.locked);
    const total = movable.length;
    if (!total) return output;
    const columns =
        direction === 'row' ? total : direction === 'column' ? 1 : Math.ceil(Math.sqrt(total)),
      rows = Math.ceil(total / columns),
      cw = Math.max(1, (100 - 2 * margin - gap * (columns - 1)) / columns),
      ch = Math.max(1, (100 - 2 * margin - gap * (rows - 1)) / rows);
    movable.forEach((layer, i) => {
      layer.x = margin + (i % columns) * (cw + gap) + cw / 2;
      layer.y = margin + Math.floor(i / columns) * (ch + gap) + ch / 2;
      layer.width = Math.min(n(layer.width, 1, 100, 75), cw);
      layer.height = Math.min(n(layer.height, 1, 100, 15), ch);
      layer.autoFit = layer.kind === 'text' || layer.kind === 'counter';
      layer.keyframes = [];
    });
    return output;
  }
  function adaptProject(project, targetFormat, options = {}) {
    if (!['9:16', '1:1', '4:5', '16:9'].includes(targetFormat))
      throw Error('Invalid aspect ratio.');
    const result = structuredClone(project),
      source = String(project.format || '9:16')
        .split(':')
        .map(Number),
      target = targetFormat.split(':').map(Number),
      ratio = target[1] / target[0] / (source[1] / source[0]),
      safe = safeBounds(options.platform || 'generic');
    result.format = targetFormat;
    result.name = (String(project.name || 'Proyecto') + ' · ' + targetFormat).slice(0, 80);
    for (const scene of result.scenes || [result]) {
      scene.facePath = [];
      scene.textX = n(scene.textX, safe.left + 10, safe.right - 10, 50);
      scene.textY = n(scene.textY, safe.top + 10, safe.bottom - 10, 45);
      scene.fontSize = n((scene.fontSize || 72) * Math.min(1, ratio), 20, 140, 72);
      scene.subtitleY = Math.min(scene.subtitleY ?? 80, safe.bottom - 5);
      for (const layer of scene.layers || []) {
        layer.width = Math.min(layer.width || 75, safe.right - safe.left);
        layer.height = Math.min((layer.height || 15) / ratio, safe.bottom - safe.top);
        layer.x = n(layer.x, safe.left + layer.width / 2, safe.right - layer.width / 2, 50);
        layer.y = n(layer.y, safe.top + layer.height / 2, safe.bottom - layer.height / 2, 50);
        layer.size = n((layer.size || 72) * Math.min(1, ratio), 16, 220, 72);
        layer.autoFit = layer.kind === 'text' || layer.kind === 'counter';
        for (const k of layer.keyframes || []) {
          if (k.x !== undefined)
            k.x = n(k.x, safe.left + layer.width / 2, safe.right - layer.width / 2, 50);
          if (k.y !== undefined)
            k.y = n(k.y, safe.top + layer.height / 2, safe.bottom - layer.height / 2, 50);
        }
      }
    }
    const active = result.scenes?.find((s) => s.id === result.activeScene);
    if (active)
      for (const [key, value] of Object.entries(active))
        if (!['id', 'name'].includes(key)) result[key] = structuredClone(value);
    return result;
  }
  function review(project, options = {}) {
    const issues = [],
      assetIds = options.assetIds ? new Set(options.assetIds) : null,
      formats = { '9:16': 9 / 16, '16:9': 16 / 9, '1:1': 1, '4:5': 4 / 5 },
      ratio = formats[project.format] || 9 / 16;
    for (const [index, scene] of (project.scenes || [project]).entries()) {
      const safe = safeBounds(scene.safePlatform || options.platform),
        add = (code, message, layerId, severity = 'warning') =>
          issues.push({ code, message, sceneId: scene.id, scene: index + 1, layerId, severity });
      if (assetIds && scene.asset && !assetIds.has(scene.asset))
        add('missing-media', 'Archivo de escena ausente.', null, 'error');
      if (scene.text) {
        const font = scene.fontSize || 72,
          fit = fitText(scene.text, 1080 * 0.84, 1080 / ratio, { fontSize: font, minSize: font });
        const halfW = Math.min(
            42,
            (Math.max(...fit.lines.map((line) => line.length * font * 0.56)) / 1080) * 50,
          ),
          halfH = ((fit.lines.length * font * 1.25) / (1080 / ratio)) * 50,
          x = scene.textX ?? 50,
          y = scene.textY ?? 50;
        if (x - halfW < 0 || x + halfW > 100 || y - halfH < 0 || y + halfH > 100)
          add('outside', 'El título principal sale del lienzo.', 'base');
        if (
          x - halfW < safe.left ||
          x + halfW > safe.right ||
          y - halfH < safe.top ||
          y + halfH > safe.bottom
        )
          add('safe-area', 'El título principal invade una zona reservada.', 'base');
      }
      for (const layer of scene.layers || []) {
        if (layer.hidden) continue;
        if (assetIds && layer.asset && !assetIds.has(layer.asset))
          add('missing-media', 'Archivo de capa ausente.', layer.id, 'error');
        const radians = ((layer.rotation || 0) * Math.PI) / 180,
          w = layer.width || 75,
          h = layer.height || 15,
          rw = Math.abs(w * Math.cos(radians)) + Math.abs(h * Math.sin(radians)) / ratio,
          rh = Math.abs(h * Math.cos(radians)) + Math.abs(w * Math.sin(radians)) * ratio;
        if (
          layer.x - rw / 2 < 0 ||
          layer.x + rw / 2 > 100 ||
          layer.y - rh / 2 < 0 ||
          layer.y + rh / 2 > 100
        )
          add('outside', 'Una capa sale del lienzo.', layer.id);
        if (
          layer.x - rw / 2 < safe.left ||
          layer.x + rw / 2 > safe.right ||
          layer.y - rh / 2 < safe.top ||
          layer.y + rh / 2 > safe.bottom
        )
          add('safe-area', 'Una capa invade la zona reservada de la interfaz social.', layer.id);
        if (
          ['text', 'counter'].includes(layer.kind) &&
          fitText(
            layer.text,
            ((layer.width || 75) / 100) * 1080,
            (((layer.height || 15) / 100) * 1080) / ratio,
            { fontSize: layer.size, minSize: layer.autoFit ? 16 : layer.size },
          ).overflow
        )
          add('text-overflow', 'El texto necesita más espacio o un tamaño menor.', layer.id);
        for (const k of normalizeKeyframes(layer.keyframes))
          if (
            (k.x ?? layer.x) < safe.left ||
            (k.x ?? layer.x) > safe.right ||
            (k.y ?? layer.y) < safe.top ||
            (k.y ?? layer.y) > safe.bottom
          ) {
            add('keyframe-outside', 'Un fotograma clave sale de la zona segura.', layer.id);
            break;
          }
      }
      for (const match of String(scene.subtitles || '').matchAll(
        /(\d\d):(\d\d):(\d\d)[,.](\d{3})\s*-->\s*(\d\d):(\d\d):(\d\d)[,.](\d{3})\s*\n([^]*?)(?=\n\s*\n|$)/g,
      )) {
        const seconds = (offset) =>
            +match[offset] * 3600 +
            +match[offset + 1] * 60 +
            +match[offset + 2] +
            +match[offset + 3] / 1000,
          duration = seconds(5) - seconds(1),
          text = match[9].replace(/<[^>]*>/g, '').trim();
        if (duration > 0 && text.length / duration > 20)
          add('fast-captions', 'Un subtítulo supera 20 caracteres por segundo.');
      }
    }
    if (assetIds)
      for (const id of [project.audio, ...(project.audioTracks || []).map((t) => t.asset)].filter(
        Boolean,
      ))
        if (!assetIds.has(id))
          issues.push({
            code: 'missing-audio',
            message: 'Falta un archivo de audio del montaje.',
            severity: 'error',
          });
    if ((options.audioPeaks || []).some((v) => Math.abs(v) >= 0.999))
      issues.push({
        code: 'audio-clipping',
        message: 'Se detectaron picos próximos a saturación; revisa el audio.',
        severity: 'warning',
      });
    return issues;
  }
  return {
    normalizeFilter,
    normalizeLUT,
    parseCube,
    sampleLUT,
    applyLUT,
    gradePixels,
    gradeRGB,
    normalizeKeyframes,
    interpolateKeyframes,
    fitText,
    safeBounds,
    layoutLayers,
    adaptProject,
    review,
  };
});
