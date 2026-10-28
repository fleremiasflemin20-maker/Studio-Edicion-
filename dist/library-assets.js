(function (root, factory) {
  const core =
    typeof module === 'object' && module.exports
      ? require('./library-core.js')
      : root.FleremahiasLibrary;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FleremahiasLibrary = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';
  const rainbow = ['#ff7e91', '#ffc17c', '#e7df8b', '#95e6b4', '#7bded7', '#8bbafd', '#c4a3f2'];
  const safeColor = (value, fallback) => (/^#[0-9a-f]{6}$/i.test(value) ? value : fallback);
  const esc = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char],
    );
  const clamp = (n, a, b, f) =>
    Number.isFinite(Number(n)) ? Math.max(a, Math.min(b, Number(n))) : f;
  function random(seed) {
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }
  function hash(string) {
    let n = 2166136261;
    for (const c of string) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return n >>> 0;
  }
  const circle = (x, y, r, fill, extra = '') =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
  const line = (x1, y1, x2, y2, stroke, width, extra = '') =>
    `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`;
  function blobPath(cx, cy, r, count, seed) {
    const rng = random(seed),
      points = Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2,
          rr = r * (0.65 + rng() * 0.35);
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
      });
    return `M${points.map((p) => p.map((n) => n.toFixed(2)).join(' ')).join('L')}Z`;
  }
  function svg(value, options = {}) {
    const item = Core.get(value);
    if (!item) throw Error('Unknown library resource.');
    if (item.type === 'sound') throw Error('Audio resources use sound().');
    const w = Math.round(clamp(options.width, 64, 4096, item.width || 1080)),
      h = Math.round(clamp(options.height, 64, 4096, item.height || 1350));
    const accent = safeColor(options.accent, item.accent || rainbow[item.variant % 7]),
      bg = safeColor(options.background, '#10191f'),
      ink = safeColor(options.ink, '#f3f7f6');
    const v = item.variant || 0,
      rng = random(hash(item.id)),
      rand = (a, b) => a + rng() * (b - a);
    let body = '',
      defs = '';
    const rect = (x, y, rw, rh, fill, rx = 0, extra = '') =>
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" rx="${rx}" fill="${fill}" ${extra}/>`;
    if (item.type === 'background') {
      body = rect(0, 0, w, h, bg);
      const u = Math.min(w, h),
        offset = (v - 2.5) * u * 0.04;
      if (item.family === 'paint') {
        for (let c = 0; c < 4; c++) {
          const x = rand(-0.1, 1.1) * w,
            y = rand(0.08, 0.92) * h,
            color = c === 0 ? accent : rainbow[(v + c * 2) % 7];
          body += `<path d="M${x - u * 0.35} ${y + u * 0.2}Q${x - u * 0.1} ${y - u * 0.25} ${x + u * 0.4} ${y - u * 0.1}" stroke="${color}" stroke-width="${u * (0.08 + c * 0.018)}" stroke-linecap="round" fill="none" opacity="${0.6 - c * 0.09}"/>`;
          for (let n = 0; n < 14; n++)
            body += circle(
              x + rand(-0.4, 0.4) * u,
              y + rand(-0.3, 0.3) * u,
              rand(0.003, 0.025) * u,
              color,
              `opacity="${rand(0.25, 0.8)}"`,
            );
        }
      } else if (item.family === 'aurora') {
        defs += `<linearGradient id="flow" x1="0" x2="1" y2="1"><stop stop-color="${accent}"/><stop offset=".5" stop-color="${rainbow[(v + 3) % 7]}"/><stop offset="1" stop-color="${bg}"/></linearGradient>`;
        for (let n = 0; n < 9; n++)
          body += `<path d="M${-w * 0.1} ${h * (0.1 + n * 0.105)}C${w * (0.2 + v * 0.04)} ${h * (-0.2 + n * 0.1)} ${w * 0.5} ${h * (0.8 + n * 0.03)} ${w * 1.1} ${h * (0.1 + n * 0.12)}L${w * 1.1} ${h * 1.1}L0 ${h * 1.1}Z" fill="url(#flow)" opacity="${0.11 + n * 0.025}"/>`;
      } else if (item.family === 'paper') {
        body = rect(
          0,
          0,
          w,
          h,
          ['#e7dfcd', '#d8decf', '#e6d9d0', '#d4dcdf', '#ded5c5', '#e3e0d9'][v],
        );
        for (let n = 0; n < 420; n++) {
          const x = rand(0, w),
            y = rand(0, h);
          body += line(
            x,
            y,
            x + rand(1, 9),
            y + rand(-2, 2),
            '#283139',
            rand(0.2, 0.7),
            `opacity="${rand(0.025, 0.12)}"`,
          );
        }
        const edge = u * (0.07 + v * 0.01);
        body += rect(
          edge,
          edge,
          w - edge * 2,
          h - edge * 2,
          'none',
          0,
          `stroke="${accent}" stroke-width="${u * 0.003}"`,
        );
        body += line(edge, h * 0.2, w * 0.58, h * 0.2, '#29353c', u * 0.004);
      } else if (item.family === 'grid') {
        const gap = u / (8 + v * 2);
        for (let x = offset; x < w; x += gap) body += line(x, 0, x, h, accent, 1, 'opacity=".15"');
        for (let y = offset; y < h; y += gap) body += line(0, y, w, y, accent, 1, 'opacity=".15"');
        for (let i = 0; i < 12; i++) {
          const x = Math.round(rand(0, w) / gap) * gap,
            y = Math.round(rand(0, h) / gap) * gap;
          body += rect(x, y, gap, gap, accent, 0, 'opacity=".12"');
          body += circle(x, y, u * 0.004, ink);
        }
        body += `<path d="M0 ${h * 0.8}L${w * 0.24} ${h * 0.8}L${w * 0.41} ${h * 0.52}L${w * 0.66} ${h * 0.52}L${w} ${h * 0.22}" fill="none" stroke="${accent}" stroke-width="${u * 0.009}"/>`;
      } else if (item.family === 'orbit') {
        const cx = w * (0.25 + v * 0.1),
          cy = h * (0.33 + (v % 3) * 0.13);
        for (let n = 1; n < 9; n++)
          body += `<ellipse cx="${cx}" cy="${cy}" rx="${u * n * 0.075}" ry="${u * n * (0.035 + v * 0.003)}" fill="none" stroke="${n % 2 ? accent : rainbow[(n + v) % 7]}" stroke-width="${u * 0.002}" opacity="${0.7 - n * 0.06}" transform="rotate(${v * 17 - 42} ${cx} ${cy})"/>`;
        for (let n = 0; n < 7; n++) {
          const a = n * 2.4 + v;
          body += circle(
            cx + Math.cos(a) * u * 0.38,
            cy + Math.sin(a) * u * 0.26,
            u * (0.015 + n * 0.003),
            rainbow[n],
          );
        }
      } else if (item.family === 'ribbon') {
        for (let n = 6; n >= 0; n--) {
          const y = h * (0.1 + n * 0.11);
          body += `<path d="M${-w * 0.2} ${y}C${w * 0.3} ${y - h * 0.25 - offset} ${w * 0.6} ${y + h * 0.3} ${w * 1.2} ${y - h * 0.14}" fill="none" stroke="${rainbow[(n + v) % 7]}" stroke-width="${u * (0.07 + (v % 3) * 0.012)}" opacity=".72"/>`;
        }
      } else if (item.family === 'contour') {
        for (let n = 0; n < 25; n++) {
          const d = Array.from({ length: 38 }, (_, i) => {
            const x = (i / 37) * w,
              y =
                h * (0.1 + n * 0.035) +
                Math.sin(i * 0.19 + v * 0.8) * u * 0.12 +
                Math.sin(i * 0.46 + n * 0.18) * u * 0.04;
            return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
          }).join('');
          body += `<path d="${d}" fill="none" stroke="${n % 6 === 0 ? accent : ink}" stroke-width="${n % 6 === 0 ? 2.5 : 1}" opacity="${n % 6 === 0 ? 0.65 : 0.17}"/>`;
        }
      } else if (item.family === 'halftone') {
        const gap = u / (17 + v * 2);
        for (let y = 0; y < h; y += gap)
          for (let x = 0; x < w; x += gap) {
            const wave = (Math.sin((x / w) * 7 + v) + Math.cos((y / h) * 6 + v)) * 0.5;
            body += circle(
              x,
              y,
              gap * (0.08 + 0.15 * (wave + 1)),
              (Math.round(y / gap) + v) % 7 === 0 ? accent : ink,
              'opacity=".28"',
            );
          }
        body += `<path d="M0 ${h * 0.83}L${w} ${h * 0.48}L${w} ${h}L0 ${h}Z" fill="${accent}" opacity=".8"/>`;
      } else if (item.family === 'tiles') {
        const cols = 4 + (v % 3),
          step = w / cols;
        for (let row = 0; row < Math.ceil(h / step); row++)
          for (let col = 0; col < cols; col++) {
            const x = col * step,
              y = row * step,
              i = (col + row + v) % 4,
              color = rainbow[(col + row * 2 + v) % 7];
            if (i === 0) body += rect(x + 5, y + 5, step - 10, step - 10, color, step * 0.2);
            if (i === 1) body += circle(x + step / 2, y + step / 2, step * 0.43, color);
            if (i === 2)
              body += `<path d="M${x} ${y + step}L${x + step} ${y + step}L${x + step} ${y}Z" fill="${color}"/>`;
            if (i === 3)
              body += `<path d="M${x + step * 0.1} ${y + step * 0.1}L${x + step * 0.9} ${y + step * 0.9}M${x + step * 0.9} ${y + step * 0.1}L${x + step * 0.1} ${y + step * 0.9}" stroke="${color}" stroke-width="${step * 0.12}"/>`;
          }
      } else if (item.family === 'stage') {
        defs += `<radialGradient id="spot"><stop stop-color="${accent}" stop-opacity=".4"/><stop offset="1" stop-color="${bg}"/></radialGradient>`;
        body += rect(0, 0, w, h, 'url(#spot)');
        body += `<ellipse cx="${w * 0.5}" cy="${h * 0.82}" rx="${w * 0.42}" ry="${h * 0.065}" fill="#000" opacity=".4"/>`;
        const pw = w * (0.45 + v * 0.035),
          ph = h * (0.1 + (v % 3) * 0.025),
          x = (w - pw) / 2,
          y = h * 0.72;
        body += rect(x, y, pw, ph, accent, 0, 'opacity=".65"');
        body += `<ellipse cx="${w / 2}" cy="${y}" rx="${pw / 2}" ry="${ph * 0.22}" fill="${ink}" opacity=".8"/>`;
        for (let n = 0; n < 3; n++)
          body += line(
            w * (0.1 + n * 0.4),
            h * 0.12,
            w * (0.1 + n * 0.4),
            h * 0.35,
            accent,
            2,
            'opacity=".2"',
          );
      }
    } else if (item.type === 'element') {
      const scaleX = w / 512,
        scaleY = h / 512;
      body = '<g transform="scale(' + scaleX + ' ' + scaleY + ')">';
      const sw = 14 + v * 3;
      switch (item.family) {
        case 'arrow': {
          const x = 395 - v * 15,
            y = 115 + v * 25;
          body += `<path d="M70 ${390 - v * 15}Q${130 + v * 35} ${100 + v * 35} ${x} ${y}M${x - 100} ${y + 3}L${x} ${y}L${x - 5} ${y + 100}" fill="none" stroke="${accent}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
          break;
        }
        case 'brush':
          for (let n = 0; n < 9; n++)
            body += `<path d="M${50 + rand(-15, 15)} ${210 + n * 10}Q${240 + v * 10} ${150 + n * 12 - v * 6} ${450 + rand(-20, 10)} ${210 + n * 10 - v * 4}" fill="none" stroke="${accent}" stroke-width="${8 + rand(0, 8)}" stroke-linecap="round" opacity="${0.35 + rand(0, 0.6)}"/>`;
          break;
        case 'drop':
          for (let n = 0; n < 18; n++) {
            const x = rand(80, 432),
              y = rand(90, 420),
              r = rand(5, 35);
            body += circle(x, y, r, accent);
            if (n % 3 === 0)
              body += `<path d="M${x - r * 0.6} ${y}Q${x + v * 5} ${y - 80 - r} ${x + r * 0.8} ${y}Z" fill="${accent}"/>`;
          }
          break;
        case 'seal': {
          const points = Array.from({ length: 24 + v * 4 }, (_, i) => {
            const a = (i / (24 + v * 4)) * Math.PI * 2,
              r = i % 2 ? 158 : 208;
            return [256 + Math.cos(a) * r, 256 + Math.sin(a) * r].join(',');
          });
          body +=
            `<polygon points="${points.join(' ')}" fill="${accent}"/>` +
            circle(256, 256, 132, 'none', `stroke="${bg}" stroke-width="5"`) +
            `<text x="256" y="275" text-anchor="middle" font-size="56" font-family="Arial" font-weight="800" fill="${bg}">${esc(options.text || ['NUEVO', 'PRO', 'TOP', 'IDEA', 'OK'][v])}</text>`;
          break;
        }
        case 'label':
          body +=
            `<path d="M55 ${140 + v * 10}H${405 - v * 10}L470 256L${405 - v * 10} ${372 - v * 10}H55Z" fill="${accent}"/>` +
            circle(407, 256, 13, bg) +
            `<text x="225" y="276" text-anchor="middle" font-family="Arial" font-size="50" font-weight="700" fill="${bg}">${esc(options.text || 'TU IDEA')}</text>`;
          break;
        case 'spark':
          for (let n = 0; n < 4 + v; n++) {
            const a = (n / (4 + v)) * Math.PI;
            body += line(
              256 - Math.cos(a) * 180,
              256 - Math.sin(a) * 180,
              256 + Math.cos(a) * 180,
              256 + Math.sin(a) * 180,
              accent,
              12 + v * 2,
            );
          }
          body += circle(256, 256, 35, ink);
          break;
        case 'frame':
          body += rect(
            40,
            75 + v * 10,
            432,
            362 - v * 20,
            'none',
            20 + v * 10,
            `stroke="${accent}" stroke-width="${sw}"`,
          );
          if (v % 2) body += line(75, 394, 200, 394, ink, 8);
          break;
        case 'speech':
          body += `<path d="M65 85H447V${330 - v * 15}H${240 + v * 20}L125 440L150 ${330 - v * 15}H65Z" fill="${accent}"/>`;
          for (let n = 0; n < 3; n++) body += circle(170 + n * 85, 210, 15 + v * 2, bg);
          break;
        case 'underline':
          for (let n = 0; n < 2 + (v % 3); n++)
            body += `<path d="M50 ${225 + n * 30}Q${220 + v * 15} ${160 + n * 50} 460 ${225 + n * 25}" fill="none" stroke="${accent}" stroke-width="${10 + v * 4}" stroke-linecap="round"/>`;
          break;
        case 'corner':
          for (let n = 0; n < 4; n++) {
            const x = n % 2 ? 450 : 62,
              y = n > 1 ? 450 : 62,
              dx = n % 2 ? -1 : 1,
              dy = n > 1 ? -1 : 1;
            body += `<path d="M${x + dx * (70 + v * 10)} ${y}H${x}V${y + dy * (70 + v * 10)}" fill="none" stroke="${accent}" stroke-width="${sw}"/>`;
          }
          break;
        case 'blob':
          body += `<path d="${blobPath(256, 256, 220, 34, hash(item.id))}" fill="${accent}"/>`;
          if (v % 2)
            body += `<path d="${blobPath(256, 256, 165, 30, hash(item.id + 'inner'))}" fill="none" stroke="${ink}" stroke-width="3"/>`;
          break;
        case 'wave':
          for (let n = 0; n < 23; n++) {
            const amp = 30 + Math.abs(Math.sin(n * 0.5 + v)) * 150;
            body += line(40 + n * 19, 256 - amp, 40 + n * 19, 256 + amp, accent, 10 + (v % 3) * 2);
          }
          break;
        case 'check':
          body +=
            circle(256, 256, 190, accent) +
            `<path d="M140 ${255 + v * 3}L225 340L380 ${160 + v * 5}" fill="none" stroke="${bg}" stroke-width="${sw + 10}" stroke-linecap="round" stroke-linejoin="round"/>`;
          break;
        case 'pointer':
          body += `<path d="M120 65L${420 - v * 10} 280L285 300L245 440Z" fill="${accent}" stroke="${ink}" stroke-width="${5 + v}"/>`;
          for (let n = 0; n < 3; n++) {
            const a = n * 0.7 + 3.6;
            body += line(
              120 + Math.cos(a) * 55,
              65 + Math.sin(a) * 55,
              120 + Math.cos(a) * 95,
              65 + Math.sin(a) * 95,
              accent,
              10,
            );
          }
          break;
        case 'burst':
          body += `<path d="${blobPath(256, 256, 230, 10 + v * 2, hash(item.id))}" fill="${accent}"/>`;
          for (let n = 0; n < 6; n++) {
            const a = (n * Math.PI) / 3 + v * 0.2;
            body += line(
              256 + Math.cos(a) * 185,
              256 + Math.sin(a) * 185,
              256 + Math.cos(a) * 235,
              256 + Math.sin(a) * 235,
              ink,
              8,
            );
          }
          break;
        case 'progress': {
          const steps = 3 + v;
          for (let n = 0; n < steps; n++) {
            const x = 55 + n * (402 / (steps - 1));
            if (n) body += line(x - 402 / (steps - 1), 256, x, 256, accent, 8);
            body += circle(x, 256, 23, n <= v ? accent : bg, `stroke="${accent}" stroke-width="5"`);
          }
          break;
        }
      }
      body += '</g>';
    } else {
      // Actual reusable composition metadata is stored in the catalog; these previews remain pure SVG.
      body = rect(0, 0, w, h, bg);
      const left = w * 0.09;
      if (item.type === 'style') {
        const e = item.effects,
          gamma = 1 / (1 + e.exposure / 100),
          slope = e.contrast / 100,
          intercept = (1 - slope) / 2;
        defs += `<filter id="look" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${e.saturation / 100}"/><feComponentTransfer>${['R', 'G', 'B'].map((channel) => `<feFunc${channel} type="linear" slope="${slope}" intercept="${intercept}"/>`).join('')}</feComponentTransfer><feComponentTransfer>${['R', 'G', 'B'].map((channel) => `<feFunc${channel} type="gamma" amplitude="1" exponent="${gamma}" offset="0"/>`).join('')}</feComponentTransfer></filter>`;
        body +=
          `<g filter="url(#look)">` +
          rect(w * 0.1, h * 0.12, w * 0.8, h * 0.58, '#d7d6b9', w * 0.03) +
          circle(w * 0.54, h * 0.4, w * 0.2, '#dd9978') +
          `<path d="M${w * 0.1} ${h * 0.7}L${w * 0.42} ${h * 0.38}L${w * 0.9} ${h * 0.7}Z" fill="#6b9d8d"/>` +
          rect(w * 0.18, h * 0.19, w * 0.16, h * 0.33, '#f1c982', w * 0.02) +
          `</g>`;
      } else if (item.type === 'transition') {
        body +=
          rect(w * 0.1, h * 0.16, w * 0.48, h * 0.45, accent, w * 0.025) +
          rect(w * 0.42, h * 0.28, w * 0.48, h * 0.45, rainbow[(v + 3) % 7], w * 0.025);
        body += `<path d="M${w * 0.22} ${h * 0.38}H${w * 0.78}M${w * 0.68} ${h * 0.31}L${w * 0.78} ${h * 0.38}L${w * 0.68} ${h * 0.45}" fill="none" stroke="${ink}" stroke-width="${w * 0.018}" stroke-linecap="round"/>`;
      } else if (item.type === 'recipe') {
        for (let n = 0; n < 3; n++)
          body +=
            rect(
              w * (0.12 + n * 0.25),
              h * (0.15 + n * 0.045),
              w * 0.22,
              h * 0.44,
              rainbow[(n + v) % 7],
              w * 0.02,
            ) +
            rect(w * (0.14 + n * 0.25), h * (0.19 + n * 0.045), w * 0.18, h * 0.25, bg, w * 0.01);
      } else {
        const k = clamp(options.time, 0, 10, 1),
          shift = (1 - Math.min(1, k * 2)) * h * 0.09;
        body += rect(left, h * 0.2, w * 0.07, w * 0.07, accent, w * 0.01);
        if (item.family === 'underline')
          body += `<path d="M${left} ${h * 0.56}Q${w * 0.5} ${h * 0.49} ${w * 0.88} ${h * 0.55}" fill="none" stroke="${accent}" stroke-width="${w * 0.018}" stroke-linecap="round"/>`;
        if (item.family === 'label')
          body += rect(left - w * 0.02, h * 0.32, w * 0.82, h * 0.22, accent, w * 0.02);
        if (item.family === 'step')
          body += `<text x="${w * 0.82}" y="${h * 0.32}" fill="${accent}" font-family="Arial" font-weight="800" font-size="${w * 0.14}">0${(v % 5) + 1}</text>`;
        body += `<text x="${left}" y="${h * 0.46 + shift}" fill="${item.family === 'label' ? bg : ink}" font-family="${item.family === 'editorial' ? 'Georgia' : 'Arial'}" font-weight="800" font-size="${w * 0.065}">${esc(String(options.text || item.name).slice(0, 25))}</text>`;
      }
      body += `<text x="${left}" y="${h * 0.84}" fill="${ink}" font-family="Arial" font-size="${w * 0.038}" font-weight="700">${esc((options.locale === 'en' ? item.nameEn : item.name).slice(0, 34))}</text><text x="${left}" y="${h * 0.9}" fill="${accent}" font-family="Arial" font-size="${w * 0.017}" letter-spacing="2">FLEREMAHIAS / ORIGINAL</text>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(options.locale === 'en' ? item.nameEn : item.name)}"><title>${esc(item.name)}</title><defs>${defs}</defs>${body}</svg>`;
  }
  function soundInfo(value) {
    const item = Core.get(value);
    if (!item || item.type !== 'sound') throw Error('Unknown sound resource.');
    const rate = 24000,
      count = Math.ceil(item.duration * rate),
      buffer = new ArrayBuffer(44 + count * 2),
      view = new DataView(buffer),
      rng = random(hash(item.id));
    const ascii = (offset, text) =>
      [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    ascii(0, 'RIFF');
    view.setUint32(4, 36 + count * 2, true);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    ascii(36, 'data');
    view.setUint32(40, count * 2, true);
    let smooth = 0;
    const variant = item.variant,
      family = item.family,
      f = 320 + variant * 210;
    for (let i = 0; i < count; i++) {
      const t = i / rate,
        p = i / count,
        noise = rng() * 2 - 1;
      smooth = smooth * 0.86 + noise * 0.14;
      const edge = Math.min(1, t / 0.008, (item.duration - t) / 0.012),
        bell = Math.sin(Math.PI * p),
        decay = Math.exp(-p * (5 + variant)),
        sine = (freq) => Math.sin(2 * Math.PI * freq * t);
      let y = 0;
      if (family === 'whoosh') y = smooth * bell * (0.8 + 0.2 * Math.sin(p * 30));
      if (family === 'click')
        y = (noise * 0.65 + sine(1700 + variant * 600) * 0.35) * Math.exp(-t * 85);
      if (family === 'pop') y = Math.sin(2 * Math.PI * (520 * t - 250 * t * t)) * decay;
      if (family === 'tick') y = (sine(2300 + variant * 500) + noise * 0.3) * Math.exp(-t * 45);
      if (family === 'rise')
        y = (Math.sin(2 * Math.PI * (150 * t + 300 * t * t)) * 0.4 + smooth * 0.8) * p * bell;
      if (family === 'swell')
        y = (sine(190 + variant * 80) + sine(285 + variant * 120) * 0.4) * bell * 0.5;
      if (family === 'paper')
        y = noise * (0.35 + 0.65 * Math.abs(Math.sin(t * (90 + variant * 40)))) * bell * 0.55;
      if (family === 'brush') y = (smooth * 0.7 + noise * 0.25) * Math.pow(bell, 0.45);
      if (family === 'bubble')
        y = Math.sin(2 * Math.PI * (900 * t - 700 * t * t)) * Math.exp(-p * 7);
      if (family === 'water')
        y =
          (Math.sin(2 * Math.PI * (1300 * t - 900 * t * t)) + 0.2 * sine(2100)) * Math.exp(-p * 9);
      if (family === 'chime')
        y = (sine(f * 2) + 0.45 * sine(f * 3.02) + 0.15 * sine(f * 5.1)) * decay * 0.6;
      if (family === 'impact')
        y = (smooth * 0.7 + Math.sin(2 * Math.PI * (90 * t - 45 * t * t)) * 0.5) * Math.exp(-p * 8);
      if (family === 'air') y = smooth * bell * 0.9;
      if (family === 'sweep')
        y = (smooth * 0.6 + Math.sin(2 * Math.PI * (220 * t + 800 * t * t)) * 0.15) * bell;
      if (family === 'success') {
        const freq = p < 0.33 ? 523.25 : p < 0.66 ? 659.25 : 783.99;
        y = sine(freq * (variant ? 1.25 : 1)) * Math.sin(((p * 3) % 1) * Math.PI) * 0.5;
      }
      if (family === 'tap')
        y = (sine(650 + variant * 160) * 0.6 + smooth * 0.5) * Math.exp(-t * 65);
      if (family === 'shimmer')
        y =
          (sine(740 + variant * 110) + sine(1110 + variant * 165) * 0.4) *
          (0.5 + 0.5 * Math.sin(t * 18)) *
          bell *
          0.35;
      if (family === 'pulse')
        y = sine(110 + variant * 55) * Math.exp(-(p % 0.33) * 20) * bell * 0.7;
      if (family === 'wood')
        y =
          (sine(420 + variant * 90) * 0.5 + sine(771 + variant * 123) * 0.3 + noise * 0.2) *
          Math.exp(-t * 38);
      if (family === 'glass')
        y =
          (sine(1410 + variant * 300) + 0.4 * sine(2783 + variant * 555) + 0.2 * sine(4270)) *
          Math.exp(-p * 9) *
          0.5;
      view.setInt16(
        44 + i * 2,
        Math.round(Math.max(-0.9, Math.min(0.9, y * edge * 0.6)) * 32767),
        true,
      );
    }
    return {
      buffer,
      mime: 'audio/wav',
      duration: count / rate,
      sampleRate: rate,
      name: item.name + '.wav',
    };
  }
  const sound = (value) => soundInfo(value).buffer;
  return Object.assign(Core, { svg, sound, soundInfo, safeColor });
});
