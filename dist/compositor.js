/**
 * Canvas compositor. A single drawing path is used by PNG, previews and video.
 * All effects are local and deterministic; no DOM strings or user code run here.
 */
(function (root) {
  const core = root.LumaCreatorCore;
  const styles = root.LumaProCore.textStyles;
  const captionCache = new Map();
  let grainTile;

  function wrap(ctx, text, maxWidth) {
    const output = [];
    for (const paragraph of String(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        if (line && ctx.measureText(line + ' ' + word).width > maxWidth) {
          output.push(line);
          line = word;
        } else line += (line ? ' ' : '') + word;
      }
      output.push(line);
    }
    return output;
  }

  function background(ctx, scene, transparent) {
    if (transparent) return;
    const { width, height } = ctx.canvas;
    const themes = {
      aurora: ['#564384', '#d2a4bd'],
      sunset: ['#bd796e', '#eacb96'],
      paper: ['#f0e8d9', '#ddd8c7'],
      midnight: ['#141b31', '#474570'],
    };
    const theme = themes[scene.background];
    let fill = scene.bg;
    if (theme) {
      fill = ctx.createLinearGradient(0, 0, width, height);
      fill.addColorStop(0, theme[0]);
      fill.addColorStop(1, theme[1]);
    }
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
  }

  function mediaFrame(ctx, scene, media, time, duration) {
    if (!media || !(media.videoWidth || media.width)) return;
    const { width: w, height: h } = ctx.canvas;
    const mw = media.videoWidth || media.width,
      mh = media.videoHeight || media.height;
    const angle = ((scene.rotation || 0) * Math.PI) / 180;
    const swapped = scene.rotation === 90 || scene.rotation === 270;
    const ow = swapped ? mh : mw,
      oh = swapped ? mw : mh;
    const progress = Math.max(0, Math.min(1, time / Math.max(0.1, duration)));
    let zoom = scene.zoom || 1,
      cropX =
        root.LumaFlowCore?.interpolate(scene.facePath, time, scene.cropX ?? 50) ??
        scene.cropX ??
        50;
    if (scene.motion === 'zoom-in') zoom *= 1 + progress * 0.15;
    if (scene.motion === 'zoom-out') zoom *= 1.15 - progress * 0.15;
    if (scene.motion === 'pan-left') {
      zoom *= 1.15;
      cropX = 35 + progress * 30;
    }
    if (scene.motion === 'pan-right') {
      zoom *= 1.15;
      cropX = 65 - progress * 30;
    }
    const scale =
      (scene.fit === 'contain' ? Math.min(w / ow, h / oh) : Math.max(w / ow, h / oh)) * zoom;
    const adjust = scene.adjust || {};
    const baseFilter =
      'brightness(' +
      (scene.brightness ?? 100) +
      '%) saturate(' +
      (scene.saturation ?? 100) +
      '%) contrast(' +
      (adjust.contrast ?? 100) +
      '%) hue-rotate(' +
      (adjust.hue || 0) +
      'deg) blur(' +
      ((adjust.blur || 0) * w) / 1080 +
      'px)';
    const preset = core.filters.find((f) => f.id === scene.filter) || core.filters[0];
    const draw = (filter) => {
      ctx.save();
      ctx.filter = filter;
      ctx.translate(
        w / 2 + (w - ow * scale) * (cropX / 100 - 0.5),
        h / 2 + (h - oh * scale) * ((scene.cropY ?? 50) / 100 - 0.5),
      );
      ctx.rotate(angle);
      ctx.scale(scene.flipX ? -1 : 1, scene.flipY ? -1 : 1);
      ctx.drawImage(media, (-mw * scale) / 2, (-mh * scale) / 2, mw * scale, mh * scale);
      ctx.restore();
    };
    draw(baseFilter);
    const strength = scene.filterStrength ?? 1;
    if (preset.css !== 'none' && strength > 0) {
      ctx.save();
      ctx.globalAlpha = strength;
      draw(baseFilter + ' ' + preset.css);
      ctx.restore();
    }
    if (preset.overlay) {
      ctx.save();
      ctx.globalAlpha = (preset.alpha || 0) * strength;
      ctx.fillStyle = preset.overlay;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    if (adjust.temperature) {
      ctx.save();
      ctx.globalAlpha = Math.abs(adjust.temperature) / 650;
      ctx.fillStyle = adjust.temperature > 0 ? '#ff943f' : '#438dff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    if (adjust.vignette) {
      const shade = ctx.createRadialGradient(
        w / 2,
        h / 2,
        w * 0.15,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.7,
      );
      shade.addColorStop(0, '#0000');
      shade.addColorStop(1, 'rgba(0,0,0,' + adjust.vignette / 100 + ')');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, w, h);
    }
    if (adjust.grain && root.document) {
      if (!grainTile) {
        grainTile = document.createElement('canvas');
        grainTile.width = grainTile.height = 96;
        const gc = grainTile.getContext('2d'),
          data = gc.createImageData(96, 96);
        let seed = 142;
        for (let i = 0; i < data.data.length; i += 4) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const grey = seed >>> 24;
          data.data.set([grey, grey, grey, 90], i);
        }
        gc.putImageData(data, 0, 0);
      }
      ctx.save();
      ctx.globalAlpha = adjust.grain / 180;
      ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  const filterCache = new WeakMap();
  const fitCache = new Map();
  let gradingSurface, fallbackSurface;
  function gradingEngine() {
    if (gradingSurface !== undefined) return gradingSurface;
    gradingSurface = null;
    try {
      const canvas = document.createElement('canvas'),
        gl = canvas.getContext('webgl2', {
          alpha: true,
          premultipliedAlpha: false,
          preserveDrawingBuffer: true,
          antialias: false,
        });
      if (!gl) return null;
      const shader = (type, source) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, source);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error('Color shader unavailable');
        return s;
      };
      const program = gl.createProgram();
      gl.attachShader(
        program,
        shader(
          gl.VERTEX_SHADER,
          `#version 300 es
        in vec2 position; out vec2 uv; void main(){uv=vec2(position.x,1.0-position.y);gl_Position=vec4(position*2.0-1.0,0,1);}`,
        ),
      );
      gl.attachShader(
        program,
        shader(
          gl.FRAGMENT_SHADER,
          `#version 300 es
        precision highp float; precision highp sampler3D;
        in vec2 uv; out vec4 result; uniform sampler2D sourceImage; uniform sampler3D colorLut;
        uniform vec4 controls; uniform vec4 lighting; uniform float intensity; uniform float useLut;
        uniform vec3 domainMin; uniform vec3 domainMax; uniform float lutSize;
        void main(){vec4 original=texture(sourceImage,uv);vec3 c=max(vec3(0),original.rgb*exp2(controls.x));
        c=(c-.5)*controls.y+.5;float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,controls.z);c+=vec3(controls.w,0,-controls.w);
        c=clamp(c,0.0,1.0);c=clamp(pow(c,vec3(1.0/lighting.x))+lighting.y*.25*pow(vec3(1)-c,vec3(2))+lighting.z*.25*pow(c,vec3(2)),0.0,1.0);
        if(useLut>.5){vec3 q=clamp((c-domainMin)/(domainMax-domainMin),0.0,1.0);q=(q*(lutSize-1.0)+.5)/lutSize;c=texture(colorLut,q).rgb;}
        result=vec4(mix(original.rgb,c,intensity),original.a);}`,
        ),
      );
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Color shader unavailable');
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const source = gl.createTexture(),
        lut = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(program, 'sourceImage'), 0);
      gl.uniform1i(gl.getUniformLocation(program, 'colorLut'), 1);
      const uniforms = Object.fromEntries(
        ['controls', 'lighting', 'intensity', 'useLut', 'domainMin', 'domainMax', 'lutSize'].map(
          (name) => [name, gl.getUniformLocation(program, name)],
        ),
      );
      gradingSurface = { canvas, gl, program, source, lut, uniforms, lutRef: null };
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        gradingSurface = null;
      });
    } catch {
      gradingSurface = null;
    }
    return gradingSurface;
  }
  function customGrade(ctx, value, time) {
    const kit = root.FleremahiasEditorKit;
    if (!value || !kit) return;
    let record = filterCache.get(value);
    const signature = [
      value.timeOffset,
      value.exposure,
      value.contrast,
      value.saturation,
      value.temperature,
      value.gamma,
      value.shadows,
      value.highlights,
      value.intensity,
      value.texture,
      value.textureStrength,
      value.paintColor,
      value.seed,
      value.motion,
    ].join('|');
    if (!record || record.signature !== signature || record.lutRef !== value.lut) {
      record = { filter: kit.normalizeFilter(value), signature, lutRef: value.lut };
      filterCache.set(value, record);
    }
    time += record.filter.timeOffset;
    const f = record.filter,
      w = ctx.canvas.width,
      h = ctx.canvas.height;
    const identity =
      f.exposure === 0 &&
      f.contrast === 100 &&
      f.saturation === 100 &&
      f.temperature === 0 &&
      f.gamma === 1 &&
      f.shadows === 0 &&
      f.highlights === 0 &&
      !f.lut;
    if (!identity && f.intensity > 0) {
      const engine = gradingEngine();
      let graded = false;
      if (engine) {
        try {
          const { canvas, gl, program, source, lut, uniforms: u } = engine;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          gl.viewport(0, 0, w, h);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, source);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);
          gl.uniform4f(
            u.controls,
            f.exposure,
            f.contrast / 100,
            f.saturation / 100,
            f.temperature * 0.0008,
          );
          gl.uniform4f(u.lighting, f.gamma, f.shadows / 100, f.highlights / 100, 0);
          gl.uniform1f(u.intensity, f.intensity);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_3D, lut);
          if (engine.lutRef !== record.filter.lut) {
            const color = record.filter.lut,
              size = color?.size || 2,
              data = new Uint8Array(size ** 3 * 4);
            for (let i = 0; i < size ** 3; i++) {
              for (let k = 0; k < 3; k++)
                data[i * 4 + k] = Math.round((color ? color.values[i * 3 + k] : 1) * 255);
              data[i * 4 + 3] = 255;
            }
            gl.texImage3D(
              gl.TEXTURE_3D,
              0,
              gl.RGBA8,
              size,
              size,
              size,
              0,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              data,
            );
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            for (const axis of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R])
              gl.texParameteri(gl.TEXTURE_3D, axis, gl.CLAMP_TO_EDGE);
            engine.lutRef = color;
          }
          // A complete identity 3D texture is needed even when no LUT is selected.
          if (!engine.initialized && !f.lut) {
            const white = new Uint8Array(32).fill(255);
            gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 2, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, white);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            for (const axis of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R])
              gl.texParameteri(gl.TEXTURE_3D, axis, gl.CLAMP_TO_EDGE);
          }
          engine.initialized = true;
          gl.uniform1f(u.useLut, f.lut ? 1 : 0);
          gl.uniform1f(u.lutSize, f.lut?.size || 2);
          gl.uniform3fv(u.domainMin, f.lut?.domainMin || [0, 0, 0]);
          gl.uniform3fv(u.domainMax, f.lut?.domainMax || [1, 1, 1]);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          if (gl.getError() !== gl.NO_ERROR) throw Error('Color pass failed');
          ctx.save();
          ctx.globalCompositeOperation = 'copy';
          ctx.drawImage(canvas, 0, 0, w, h);
          ctx.restore();
          graded = true;
        } catch {
          gradingSurface = null;
        }
      }
      if (!graded) {
        // Memory-bounded fallback for devices without WebGL2. The same color transform is used.
        fallbackSurface ||= document.createElement('canvas');
        const scale = Math.min(1, 1280 / Math.max(w, h));
        fallbackSurface.width = Math.max(1, Math.round(w * scale));
        fallbackSurface.height = Math.max(1, Math.round(h * scale));
        const fc = fallbackSurface.getContext('2d', { willReadFrequently: true });
        fc.drawImage(ctx.canvas, 0, 0, fallbackSurface.width, fallbackSurface.height);
        const pixels = fc.getImageData(0, 0, fallbackSurface.width, fallbackSurface.height);
        kit.gradePixels(pixels.data, f);
        fc.putImageData(pixels, 0, 0);
        ctx.save();
        ctx.globalCompositeOperation = 'copy';
        ctx.drawImage(fallbackSurface, 0, 0, w, h);
        ctx.restore();
      }
    }
    if (f.texture === 'none' || !f.textureStrength || !f.intensity) return;
    let seed = f.seed >>> 0;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const pulse = f.motion === 'pulse' ? 0.7 + 0.3 * Math.sin(time * 3) : 1,
      offset = f.motion === 'drift' ? Math.sin(time * 0.7) * w * 0.04 : 0;
    ctx.save();
    ctx.globalAlpha = f.textureStrength * f.intensity * pulse;
    ctx.fillStyle = f.paintColor;
    if (f.texture === 'grain' || f.texture === 'paper') {
      if (!record.tile) {
        const tile = document.createElement('canvas');
        tile.width = tile.height = 96;
        const c = tile.getContext('2d'),
          pixels = c.createImageData(96, 96);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const shade =
            f.texture === 'paper' ? 160 + Math.round(random() * 80) : Math.round(random() * 255);
          pixels.data.set([shade, shade, shade, 75], i);
        }
        c.putImageData(pixels, 0, 0);
        record.tile = tile;
      }
      ctx.globalCompositeOperation = f.texture === 'paper' ? 'multiply' : 'soft-light';
      ctx.translate(offset, 0);
      ctx.fillStyle = ctx.createPattern(record.tile, 'repeat');
      ctx.fillRect(-w, 0, w * 3, h);
    } else if (f.texture === 'glow') {
      for (let i = 0; i < 4; i++) {
        const x = random() * w + offset,
          y = random() * h,
          r = w * (0.12 + random() * 0.3),
          gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, f.paintColor);
        gradient.addColorStop(1, f.paintColor + '00');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      const count = f.texture === 'ink' ? 34 : 24;
      for (let i = 0; i < count; i++) {
        const x = random() * w + offset,
          baseY = random() * h,
          fall = f.motion === 'paint-fall' ? ((time * (0.07 + random() * 0.06)) % 1) * h : 0,
          y = (baseY + fall) % h,
          r = w * (0.003 + random() * 0.035);
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.7 + random() * 1.5), random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        if (i % 4 === 0) {
          ctx.fillRect(x - r * 0.12, y, r * 0.24, h * 0.08 * random());
        }
      }
    }
    ctx.restore();
  }

  function textBlock(ctx, options) {
    const {
      text,
      size,
      maxWidth,
      style = 'clean',
      color = '#fff',
      fill = '#7658df',
      font = 'sans-serif',
    } = options;
    const config = styles.find((s) => s.id === style) || styles[0];
    const family = style === 'editorial' ? 'serif' : style === 'mono' ? 'monospace' : font;
    const weight =
      style === 'minimal' ? 500 : style === 'editorial' ? 600 : style === 'poster' ? 900 : 800;
    ctx.save();
    ctx.font = weight + ' ' + size + 'px ' + family;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrap(ctx, text, maxWidth),
      width = Math.max(1, ...lines.map((line) => ctx.measureText(line).width)),
      height = Math.max(size, lines.length * size * 1.25);
    const pad = size * 0.25;
    if (['boxed', 'highlight', 'glass', 'label', 'subtitle', 'stamp'].includes(style)) {
      ctx.fillStyle =
        style === 'highlight'
          ? '#ffe568'
          : style === 'glass'
            ? '#ffffff33'
            : style === 'subtitle'
              ? '#17171be8'
              : fill;
      ctx.beginPath();
      ctx.roundRect(
        -width / 2 - pad,
        -height / 2 - pad,
        width + pad * 2,
        height + pad * 2,
        style === 'label' ? size * 0.6 : size * 0.15,
      );
      ctx.fill();
      if (style === 'glass' || style === 'stamp') {
        ctx.strokeStyle = '#ffffff99';
        ctx.lineWidth = Math.max(1, size * 0.035);
        ctx.stroke();
      }
    }
    ctx.fillStyle = color;
    ctx.shadowColor = '#0007';
    ctx.shadowBlur = size / 10;
    if (style === 'minimal' || style === 'editorial' || style === 'mono') ctx.shadowBlur = 0;
    if (style === 'shadow') {
      ctx.shadowBlur = 0;
      ctx.shadowColor = '#362435aa';
      ctx.shadowOffsetX = size * 0.07;
      ctx.shadowOffsetY = size * 0.08;
    }
    if (style === 'neon') {
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 0.35;
    }
    if (style === 'gradient') {
      const gradient = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, '#7ce6db');
      ctx.fillStyle = gradient;
    }
    for (const [i, line] of lines.entries()) {
      const y = (i - (lines.length - 1) / 2) * size * 1.25;
      if (['outline', 'comic', 'poster'].includes(style)) {
        ctx.strokeStyle = '#15151b';
        ctx.lineWidth = size * (style === 'poster' ? 0.035 : 0.075);
        ctx.lineJoin = 'round';
        ctx.strokeText(line, 0, y);
      }
      ctx.fillText(line, 0, y);
    }
    ctx.restore();
    return { w: width + pad, h: height + pad };
  }

  function drawShape(ctx, layer, w, h, time, duration) {
    ctx.fillStyle = layer.fill;
    if (layer.shape === 'circle') {
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (layer.shape === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h * 0.15);
      ctx.lineTo(w * 0.15, -h * 0.15);
      ctx.lineTo(w * 0.15, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w * 0.15, h / 2);
      ctx.lineTo(w * 0.15, h * 0.15);
      ctx.lineTo(-w / 2, h * 0.15);
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (layer.shape === 'line') {
      ctx.fillRect(-w / 2, -Math.max(2, h * 0.1) / 2, w, Math.max(2, h * 0.1));
      return;
    }
    if (layer.shape === 'progress') {
      ctx.save();
      ctx.globalAlpha *= 0.2;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
      ctx.fillRect(
        -w / 2,
        -h / 2,
        (w * Math.max(0, Math.min(1, time / duration)) * (layer.progress ?? 100)) / 100,
        h,
      );
      return;
    }
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(h * 0.2, w * 0.06));
    ctx.fill();
  }

  function drawLayer(ctx, scene, layer, time, duration, images) {
    if (layer.hidden || time < (layer.startAt || 0) || (layer.endAt > 0 && time >= layer.endAt))
      return null;
    const keyed = root.FleremahiasEditorKit?.interpolateKeyframes(
      layer.keyframes,
      time - (layer.startAt || 0),
      layer,
    );
    if (keyed) layer = { ...layer, ...keyed };
    const w = ctx.canvas.width,
      h = ctx.canvas.height;
    let size = (layer.size * w) / 1080;
    if (layer.autoFit && ['text', 'counter'].includes(layer.kind) && root.FleremahiasEditorKit) {
      const cacheKey = JSON.stringify([
        layer.text,
        layer.size,
        layer.width,
        layer.height,
        scene.font,
        w,
        h,
      ]);
      if (!fitCache.has(cacheKey)) {
        fitCache.set(
          cacheKey,
          root.FleremahiasEditorKit.fitText(
            layer.text,
            (w * layer.width) / 100,
            (h * layer.height) / 100,
            {
              fontSize: size,
              minSize: Math.min(size, (w * 16) / 1080),
              measure: (line, fontSize) => {
                ctx.save();
                ctx.font = '800 ' + fontSize + 'px ' + scene.font;
                const width = ctx.measureText(line).width;
                ctx.restore();
                return width;
              },
            },
          ),
        );
        if (fitCache.size > 250) fitCache.delete(fitCache.keys().next().value);
      }
      size = fitCache.get(cacheKey).size;
    }
    const local = Math.max(0, time - (layer.startAt || 0)),
      progress = Math.min(1, local / (layer.animationDuration || 0.55)),
      ease = 1 - Math.pow(1 - progress, 3);
    let scale = keyed?.scale ?? 1,
      dy = 0,
      rotation = layer.rotation,
      alpha = layer.opacity;
    if (layer.animation === 'fade') alpha *= ease;
    if (layer.animation === 'slide') {
      dy = (1 - ease) * h * 0.08;
      alpha *= ease;
    }
    if (layer.animation === 'pop') {
      scale *= 0.65 + 0.35 * ease;
      alpha *= ease;
    }
    if (layer.animation === 'float') dy = Math.sin(local * 2) * h * 0.008;
    if (layer.animation === 'bounce') {
      dy = -Math.abs(Math.sin(local * 7)) * Math.max(0, 1 - local) * h * 0.04;
    }
    if (layer.animation === 'rotate') {
      rotation += (1 - ease) * -35;
      alpha *= ease;
    }
    if (layer.animation === 'pulse') scale *= 1 + Math.sin(local * 3) * 0.04;
    ctx.save();
    ctx.translate((w * layer.x) / 100, (h * layer.y) / 100 + dy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    let bounds = { w: (w * layer.width) / 100, h: (h * layer.height) / 100 };
    if (layer.kind === 'shape')
      drawShape(
        ctx,
        layer,
        bounds.w,
        bounds.h,
        local,
        Math.max(0.1, duration - (layer.startAt || 0)),
      );
    else if (layer.kind === 'image' || layer.kind === 'video') {
      const image = images.get(layer.kind === 'video' ? layer.id : layer.asset);
      if (image) ctx.drawImage(image, -bounds.w / 2, -bounds.h / 2, bounds.w, bounds.h);
    } else {
      let text =
        layer.kind === 'counter'
          ? layer.text.replace(/\{n\}/g, String(Math.max(0, Math.ceil(duration - time))))
          : layer.text;
      if (layer.animation === 'typewriter') text = text.slice(0, Math.ceil(text.length * ease));
      if (layer.kind === 'sticker') {
        ctx.font = size + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);
        bounds = { w: Math.max(size, ctx.measureText(text).width), h: size * 1.2 };
      } else
        bounds = textBlock(ctx, {
          text,
          size,
          maxWidth: bounds.w,
          style: layer.style,
          color: layer.color,
          fill: layer.fill,
          font: scene.font,
        });
    }
    ctx.restore();
    const angle = (rotation * Math.PI) / 180,
      rw = scale * (Math.abs(bounds.w * Math.cos(angle)) + Math.abs(bounds.h * Math.sin(angle))),
      rh = scale * (Math.abs(bounds.w * Math.sin(angle)) + Math.abs(bounds.h * Math.cos(angle)));
    return {
      id: layer.id,
      x: (w * layer.x) / 100 - rw / 2,
      y: (h * layer.y) / 100 + dy - rh / 2,
      w: rw,
      h: rh,
    };
  }

  function captions(ctx, scene, time) {
    const text = scene.subtitles || '';
    if (!text) return;
    if (!captionCache.has(text)) {
      try {
        captionCache.set(text, root.LumaCore.parseSRT(text));
      } catch {
        return;
      }
      if (captionCache.size > 30) captionCache.delete(captionCache.keys().next().value);
    }
    const block = captionCache.get(text).find((b) => time >= b.start && time < b.end);
    if (!block) return;
    const w = ctx.canvas.width,
      h = ctx.canvas.height,
      size = w * 0.045,
      style = scene.subtitleStyle || 'dark';
    ctx.save();
    ctx.font = '800 ' + size + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrap(ctx, block.text, w * 0.82).slice(0, 6),
      words = block.text.trim().split(/\s+/),
      hot = Math.min(
        words.length - 1,
        Math.floor(((time - block.start) / (block.end - block.start)) * words.length),
      );
    let index = 0;
    for (const [i, line] of lines.entries()) {
      const y = h * ((scene.subtitleY ?? 80) / 100) + i * size * 1.3,
        width = ctx.measureText(line).width;
      if (!['plain', 'outline'].includes(style)) {
        ctx.fillStyle =
          style === 'pill'
            ? '#7658df'
            : style === 'mint'
              ? '#b8eedc'
              : style === 'magenta'
                ? '#b13887'
                : '#17171be8';
        ctx.beginPath();
        ctx.roundRect(
          (w - width) / 2 - size * 0.35,
          y - size * 0.65,
          width + size * 0.7,
          size * 1.3,
          style === 'pill' ? size * 0.7 : 2,
        );
        ctx.fill();
      }
      ctx.shadowColor = '#0009';
      ctx.shadowBlur = ['plain', 'outline'].includes(style) ? size / 7 : 0;
      if (style === 'karaoke') {
        let x = (w - width) / 2;
        ctx.textAlign = 'left';
        for (const word of line.split(' ')) {
          const wordTime = scene.words?.find(
            (q) => q.text.trim() === word.trim() && time >= q.start && time < q.end,
          );
          ctx.fillStyle = (scene.words?.length ? !!wordTime : index === hot)
            ? '#ffe46d'
            : '#ffffff';
          ctx.fillText(word, x, y);
          x += ctx.measureText(word + ' ').width;
          index++;
        }
      } else {
        ctx.fillStyle = style === 'yellow' ? '#ffe46d' : style === 'mint' ? '#213f36' : '#ffffff';
        ctx.textAlign = 'center';
        if (style === 'outline') {
          ctx.lineWidth = size * 0.1;
          ctx.strokeStyle = '#17171b';
          ctx.strokeText(line, w / 2, y);
        }
        ctx.fillText(line, w / 2, y);
      }
    }
    ctx.restore();
  }

  function paint(ctx, scene, media, time, images = new Map(), options = {}) {
    const w = ctx.canvas.width,
      h = ctx.canvas.height,
      boxes = [],
      duration = Math.max(0.1, core.length(scene));
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    background(ctx, scene, options.transparent);
    mediaFrame(ctx, scene, media, time, duration);
    customGrade(ctx, scene.customFilter, time);
    if (scene.text) {
      ctx.save();
      ctx.translate((w * (scene.textX ?? 50)) / 100, (h * (scene.textY ?? 50)) / 100);
      const bounds = textBlock(ctx, {
        text: scene.text,
        size: (scene.fontSize * w) / 1080,
        maxWidth: w * 0.84,
        style: scene.titleStyle,
        color: scene.color,
        fill: scene.bg,
        font: scene.font,
      });
      ctx.restore();
      boxes.push({
        id: 'base',
        x: (w * (scene.textX ?? 50)) / 100 - bounds.w / 2,
        y: (h * (scene.textY ?? 50)) / 100 - bounds.h / 2,
        ...bounds,
      });
    }
    for (const layer of scene.layers || []) {
      const bounds = drawLayer(ctx, scene, layer, time, duration, images);
      if (bounds) boxes.push(bounds);
    }
    captions(ctx, scene, time);
    ctx.restore();
    return boxes;
  }
  root.LumaCompositor = { paint };
})(globalThis);

// Compatibility boundary: the rest of the app only calls this renderer contract.
function paintScene(ctx, scene, media, time) {
  return LumaCompositor.paint(ctx, scene, media, time, assetImages);
}
