(function () {
  'use strict';
  const Core = window.FleremahiasMotionCore,
    en = () => document.documentElement.lang === 'en',
    t = (es, eng) => (en() ? eng : es);
  let draft;
  try {
    draft = Core.normalize(JSON.parse(localStorage.getItem('fleremahias-motion-v1') || '{}'));
  } catch {
    draft = Core.normalize();
  }
  let dialog,
    frame,
    nonce,
    loaded = false,
    busy = null,
    output = null,
    starter = '',
    counter = 0;
  let engineReady = false,
    preparing = false,
    loadRevision = 0,
    pendingLoad = '';
  const send = (type, data = {}) =>
    frame?.contentWindow.postMessage({ source: 'fleremahias-studio', nonce, type, ...data }, '*');
  const status = (message) => {
    dialog.querySelector('[role=status]').textContent = message;
  };
  function save() {
    localStorage.setItem('fleremahias-motion-v1', JSON.stringify(draft));
  }
  async function prepareMedia(value) {
    await ready;
    const media = { imageData: '', audioData: '', waveform: [], audioDuration: 0 };
    if (value.imageAsset) {
      const asset = assets.find((a) => a.id === value.imageAsset);
      if (!asset || !asset.type.startsWith('image/'))
        throw Error(
          t(
            'La imagen ya no está disponible. Impórtala de nuevo.',
            'The image is unavailable. Import it again.',
          ),
        );
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () =>
          reject(Error(t('No se pudo abrir la imagen.', 'Could not open the image.')));
        image.src = asset.url;
      });
      const scale = Math.min(1, 2160 / Math.max(image.naturalWidth, image.naturalHeight)),
        canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob || blob.size > 30 * 1024 * 1024)
        throw Error(t('La imagen preparada supera 30 MB.', 'The prepared image exceeds 30 MB.'));
      media.imageData = await dataURL(blob);
    }
    if (value.audioAsset) {
      const asset = assets.find((a) => a.id === value.audioAsset);
      if (!asset || !/^(audio|video)\//.test(asset.type))
        throw Error(
          t(
            'El audio ya no está disponible. Impórtalo de nuevo.',
            'The audio is unavailable. Import it again.',
          ),
        );
      if (asset.blob.size > 100 * 1024 * 1024)
        throw Error(
          t(
            'Para Motion, importa audio de menos de 100 MB.',
            'For Motion, import audio smaller than 100 MB.',
          ),
        );
      const decoded = await LumaFlowMedia.decode(asset, 16000),
        clip = Core.clipAudio(
          decoded.getChannelData(0),
          decoded.sampleRate,
          value.audioStart,
          value.duration,
        );
      media.audioData = await dataURL(new Blob([clip.wav], { type: 'audio/wav' }));
      media.audioDuration = clip.duration;
      media.waveform = clip.waveform;
    }
    return Core.validateMedia(media);
  }
  function refreshSources() {
    if (!dialog) return;
    for (const key of ['imageAsset', 'audioAsset']) {
      const selector = dialog.querySelector('[data-field=' + key + ']'),
        list = assets.filter((a) =>
          key === 'imageAsset' ? a.type.startsWith('image/') : /^(audio|video)\//.test(a.type),
        );
      selector.innerHTML =
        '<option value="">' +
        t('Sin archivo', 'No file') +
        '</option>' +
        list.map((a) => '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>').join('');
      if (draft[key] && !list.some((a) => a.id === draft[key]))
        selector.insertAdjacentHTML(
          'beforeend',
          '<option value="' +
            esc(draft[key]) +
            '">' +
            t('Archivo no disponible', 'File unavailable') +
            '</option>',
        );
      selector.value = draft[key];
    }
  }
  async function loadDraft(type = 'load') {
    const revision = ++loadRevision,
      snapshot = Core.normalize(draft);
    loaded = false;
    preparing = true;
    syncBusy();
    status(t('Preparando composición y archivos…', 'Preparing composition and media…'));
    try {
      const media = await prepareMedia(snapshot);
      if (revision !== loadRevision) return;
      if (engineReady) {
        pendingLoad = type + '-' + ++counter;
        send(type, { id: pendingLoad, draft: snapshot, media });
      }
    } catch (error) {
      if (revision === loadRevision) status(error.message);
    } finally {
      if (revision === loadRevision) {
        preparing = false;
        syncBusy();
      }
    }
  }
  async function apply() {
    if (busy || preparing) return;
    dialog.querySelectorAll('[data-field]').forEach((el) => (draft[el.dataset.field] = el.value));
    draft = Core.normalize(draft);
    save();
    await loadDraft();
  }
  function syncBusy() {
    dialog.querySelectorAll('[data-field]').forEach((el) => (el.disabled = !!busy || preparing));
    dialog.querySelector('[data-action=cancel]').disabled = !busy;
    dialog.querySelector('[data-action=apply]').disabled = !!busy || preparing;
  }
  function fill() {
    refreshSources();
    dialog
      .querySelectorAll('[data-field]')
      .forEach(
        (el) =>
          (el.value =
            el.dataset.field === 'values' ? draft.values.join(', ') : draft[el.dataset.field]),
      );
  }
  function open() {
    if (!dialog && !localStorage.getItem('fleremahias-motion-v1') && en())
      draft = Core.normalize({
        ...draft,
        title: 'Create with your signature.',
        subtitle: 'One idea. Endless possibilities.',
        cta: 'Make it yours.',
      });
    if (dialog) {
      refreshSources();
      if (!dialog.open) dialog.showModal();
      return;
    }
    dialog = document.createElement('dialog');
    dialog.className = 'motion-lab';
    dialog.innerHTML = `<header><div><strong>Fleremahias Motion · 2D / 3D</strong><small>React + Remotion · ${t('Animación por código', 'Code-driven animation')}</small></div><button data-action="close">${t('Cerrar', 'Close')} ×</button></header><div class="motion-layout"><section class="motion-settings"><label>${t('Plantilla', 'Template')}<select data-field="preset">${Core.presets.map((p) => `<option value="${p.id}">${p.kind} · ${p.name}</option>`).join('')}</select></label>${[
      ['title', 'Título', 'Title'],
      ['subtitle', 'Subtítulo', 'Subtitle'],
      ['cta', 'Llamada a la acción', 'Call to action'],
    ]
      .map(
        ([key, es, eng]) =>
          `<label>${t(es, eng)}<input data-field="${key}" maxlength="300"></label>`,
      )
      .join(
        '',
      )}<label>${t('Color principal', 'Accent color')}<input type="color" data-field="accent"></label><label>${t('Fondo', 'Background')}<input type="color" data-field="background"></label><label>${t('Formato', 'Aspect ratio')}<select data-field="format"><option>9:16</option><option>16:9</option><option>1:1</option><option>4:5</option></select></label><label>${t('Resolución', 'Resolution')}<select data-field="quality"><option>720</option><option>1080</option><option>2160</option></select></label><label>FPS<select data-field="fps"><option>24</option><option>30</option><option>60</option></select></label><label>${t('Duración (segundos)', 'Duration (seconds)')}<input data-field="duration" type="number" min="1" max="30"></label><label>${t('Música original', 'Original music')}<select data-field="sound"><option value="off">${t('Sin música', 'No music')}</option><option value="pulse">Pulse</option><option value="ambient">Ambient</option></select></label><label>${t('Imagen de la biblioteca', 'Library image')}<select data-field="imageAsset"></select></label><label>${t('Audio de la biblioteca', 'Library audio')}<select data-field="audioAsset"></select></label><label>${t('Inicio del audio (s)', 'Audio start (s)')}<input type="number" data-field="audioStart" min="0" max="86400" step="0.1"></label><label>${t('Valores 3D (1–8 números separados por coma)', '3D values (1–8 comma-separated numbers)')}<input data-field="values" maxlength="180"></label><p>${t('Foto en movimiento requiere una imagen. Audio visual requiere audio. Se usa un fragmento de hasta 30 segundos desde el inicio indicado.', 'Photo motion requires an image. Audiogram requires audio. A segment of up to 30 seconds is used from the selected start.')}</p><button data-action="import-media">${t('Importar imagen o audio', 'Import image or audio')}</button><input data-motion-media type="file" accept="image/*,audio/*,video/*" multiple hidden><button data-action="apply" class="primary">${t('Aplicar y previsualizar', 'Apply and preview')}</button></section><section class="motion-stage"><iframe title="Motion preview" allow="autoplay" sandbox="allow-scripts" src="motion/engine.html"></iframe><div class="motion-transport"><button data-action="play">▶ / Ⅱ</button><input aria-label="${t('Fotograma', 'Frame')}" data-action="seek" type="range" min="0" max="179" value="0"></div><p role="status" aria-live="polite">${t('Cargando motor…', 'Loading engine…')}</p><div class="motion-actions"><button data-action="png">PNG</button><button data-action="mp4">MP4</button><button data-action="webm">WebM</button><button data-action="cancel">${t('Cancelar exportación', 'Cancel export')}</button><button data-action="download" disabled>${t('Descargar resultado', 'Download result')}</button><button data-action="montage" disabled>${t('Añadir al montaje abierto', 'Add to open sequence')}</button><button data-action="library" disabled>${t('Guardar en biblioteca', 'Save to library')}</button></div><p>${t('Los archivos se renderizan en este dispositivo. 3D requiere WebGL; la exportación depende de los códecs y memoria disponibles.', 'Files render on this device. 3D requires WebGL; export depends on available codecs and memory.')}</p></section><section class="motion-code"><h3>${t('Código React / TSX', 'React / TSX code')}</h3><p>${t('Opcional. Deja vacío para usar la plantilla. Importaciones: react, remotion, three y @remotion/three. El código se ejecuta aislado, sin acceso a tus proyectos ni a la red.', 'Optional. Leave empty to use a template. Imports: react, remotion, three and @remotion/three. Code runs in isolation without access to your projects or the network.')}</p><textarea data-field="code" spellcheck="false" aria-label="React code"></textarea><button data-action="starter">${t('Insertar ejemplo editable', 'Insert editable example')}</button><button data-action="project">${t('Descargar proyecto Motion', 'Download Motion project')}</button><button data-action="import">${t('Abrir proyecto Motion', 'Open Motion project')}</button><p>${t('El JSON conserva ajustes y referencias. Usa Proyecto completo para transferir también los archivos originales.', 'JSON preserves settings and references. Use Complete project to transfer original media too.')}</p><input type="file" accept=".json,application/json" hidden><p>${t('Remotion tiene condiciones de licencia comercial. Revisa la licencia antes de publicar vídeos para tu negocio.', 'Remotion has commercial licensing terms. Review the license before publishing videos for your business.')} <a href="https://www.remotion.pro/license" target="_blank" rel="noopener">Remotion license ↗</a></p></section></div>`;
    document.body.append(dialog);
    frame = dialog.querySelector('iframe');
    nonce = crypto.randomUUID();
    dialog.addEventListener('input', (e) => {
      if (e.target.matches('[data-field]') && !busy) {
        loaded = false;
        status(
          t(
            'Cambios pendientes: pulsa Aplicar y previsualizar.',
            'Changes pending: click Apply and preview.',
          ),
        );
      }
    });
    dialog.addEventListener('cancel', (e) => {
      if (busy) e.preventDefault();
    });
    dialog.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      try {
        if (action === 'close') {
          if (busy) {
            status(
              t('Cancela la exportación antes de cerrar.', 'Cancel the export before closing.'),
            );
            return;
          }
          dialog.close();
        }
        if (action === 'apply') await apply();
        if (action === 'import-media' && !busy && !preparing)
          dialog.querySelector('[data-motion-media]').click();
        if (action === 'play' && loaded && !busy) send('play');
        if (action === 'starter' && !busy) {
          dialog
            .querySelectorAll('[data-field]')
            .forEach((el) => (draft[el.dataset.field] = el.value));
          draft.code = starter;
          fill();
          await apply();
        }
        if (action === 'project') {
          await apply();
          download(
            new Blob([Core.serialize(draft)], { type: 'application/json' }),
            'Fleremahias-Motion.json',
          );
        }
        if (action === 'import' && !busy)
          dialog.querySelector('input[type=file]:not([data-motion-media])').click();
        if (action === 'cancel' && busy) {
          send('cancel');
          status(t('Cancelando…', 'Canceling…'));
        }
        if (['png', 'mp4', 'webm'].includes(action)) {
          if (!loaded || busy) {
            status(
              t(
                'Aplica primero la composición y espera a que esté lista.',
                'Apply the composition and wait until it is ready.',
              ),
            );
            return;
          }
          const id = 'render-' + ++counter;
          busy = { id, kind: action };
          syncBusy();
          setTimeout(() => {
            if (busy?.id === id) {
              send('cancel');
              busy = null;
              syncBusy();
              status(
                t(
                  'La exportación agotó el tiempo. Reduce la resolución o duración.',
                  'Export timed out. Reduce resolution or duration.',
                ),
              );
            }
          }, 180000);
          status(t('Renderizando…', 'Rendering…'));
          send('render', {
            id,
            kind: action,
            container: action,
            frame: +dialog.querySelector('[data-action=seek]').value,
            licenseKey: 'free-license',
            isProduction: !['localhost', '127.0.0.1'].includes(location.hostname),
          });
        }
        if (action === 'download' && output) download(output.blob, output.name);
        if (action === 'montage' && output) {
          if (rendering || batchBusy) {
            status(
              t('Termina primero la exportación del editor.', 'Finish the editor export first.'),
            );
            return;
          }
          if (!p()) {
            status(
              t(
                'Abre primero un proyecto en el editor. Tu resultado sigue disponible para descargar o guardar.',
                'Open a project in the editor first. Your result remains available to download or save.',
              ),
            );
            return;
          }
          if (p().scenes.length >= 24) {
            status(t('El proyecto ya tiene 24 escenas.', 'The project already has 24 scenes.'));
            return;
          }
          const asset = await storeAsset(output.blob, output.name);
          addScene(asset.id);
          const scene = p().scenes.find((s) => s.id === p().activeScene);
          scene.duration = output.duration;
          scene.sourceDuration = output.duration;
          scene.start = 0;
          scene.end = output.duration;
          P.activate(p(), scene.id, false);
          save();
          renderEditor();
          dialog.close();
          return;
        }
        if (action === 'library' && output) {
          await storeAsset(output.blob, output.name);
          status(t('Resultado guardado en Medios.', 'Result saved to Media.'));
        }
      } catch (error) {
        status(error.message);
      }
    });
    dialog.querySelector('[data-action=seek]').oninput = (e) => {
      if (loaded && !busy) send('seek', { frame: +e.target.value });
    };
    dialog.querySelector('input[type=file]:not([data-motion-media])').onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 130000) throw Error(t('Archivo demasiado grande.', 'File too large.'));
        draft = Core.parse(await file.text());
        fill();
        await apply();
      } catch (error) {
        status(error.message);
      } finally {
        e.target.value = '';
      }
    };
    dialog.querySelector('[data-motion-media]').onchange = async (e) => {
      try {
        if (busy || preparing) return;
        const list = [...e.target.files].slice(0, 10);
        for (const file of list) {
          if (!/^(image|audio|video)\//.test(file.type) || file.size > 100 * 1024 * 1024)
            throw Error(
              t(
                'Importa imágenes o audio/vídeo de menos de 100 MB.',
                'Import images or audio/video smaller than 100 MB.',
              ),
            );
          const item = await storeAsset(file, file.name);
          if (file.type.startsWith('image/')) draft.imageAsset = item.id;
          else draft.audioAsset = item.id;
        }
        fill();
        await apply();
      } catch (error) {
        status(error.message);
      } finally {
        e.target.value = '';
      }
    };
    fill();
    ready.then(() => {
      if (dialog) refreshSources();
    });
    syncBusy();
    dialog.showModal();
    setTimeout(() => {
      if (!loaded)
        status(
          t(
            'El motor aún no está listo. Reabre el panel o revisa la compatibilidad del navegador.',
            'The engine is not ready yet. Reopen the panel or check browser compatibility.',
          ),
        );
    }, 20000);
  }
  window.addEventListener('message', async (event) => {
    if (!frame || event.source !== frame.contentWindow) return;
    const m = event.data;
    if (m?.source !== 'fleremahias-motion') return;
    if (m.type === 'engine-ready') {
      engineReady = true;
      loadDraft('init');
      return;
    }
    if (m.nonce !== nonce) return;
    if (m.type === 'loaded' && m.id === pendingLoad) {
      loaded = true;
      starter = m.starter;
      dialog.querySelector('[data-action=seek]').max = m.config.durationInFrames - 1;
      ['mp4', 'webm'].forEach(
        (key) => (dialog.querySelector(`[data-action=${key}]`).disabled = !m.capabilities[key]),
      );
      status(t('Composición lista.', 'Composition ready.'));
    }
    if (m.type === 'frame' && !busy) dialog.querySelector('[data-action=seek]').value = m.frame;
    if (m.type === 'progress' && busy?.id === m.id)
      status(t('Renderizando', 'Rendering') + ' ' + Math.round(m.progress * 100) + '%');
    if (m.type === 'error') {
      if (/^(init|load)-/.test(m.id || '') && m.id !== pendingLoad) return;
      if (busy?.id === m.id) {
        busy = null;
        syncBusy();
      }
      status(
        /cancel/i.test(m.message)
          ? t(
              'Exportación cancelada. El último resultado terminado se conserva.',
              'Export canceled. The last completed result is preserved.',
            )
          : m.message,
      );
    }
    if (m.type === 'license' && busy?.id === m.renderId) {
      try {
        const response = await fetch('https://www.remotion.pro/api/track/register-usage-point', {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'web-render',
            apiKey: null,
            host: location.origin,
            succeeded: m.succeeded === true,
            isStill: m.isStill === true,
            isProduction: !['localhost', '127.0.0.1'].includes(location.hostname),
            idempotencyKey: String(m.idempotencyKey).slice(0, 80),
          }),
        });
        send('license-result', { id: m.id, status: response.status, body: await response.text() });
      } catch {
        send('license-result', { id: m.id, status: 503, body: '{}' });
      }
    }
    if (m.type === 'result' && busy?.id === m.id) {
      if (
        !(m.bytes instanceof ArrayBuffer) ||
        m.bytes.byteLength > 200 * 1024 * 1024 ||
        !m.bytes.byteLength
      ) {
        busy = null;
        syncBusy();
        status('Invalid render');
        return;
      }
      const kind = busy.kind;
      busy = null;
      syncBusy();
      output = {
        blob: new Blob([m.bytes], {
          type: kind === 'png' ? 'image/png' : kind === 'mp4' ? 'video/mp4' : 'video/webm',
        }),
        name: 'Fleremahias-Motion.' + kind,
        duration: draft.duration,
      };
      ['download', 'library', 'montage'].forEach(
        (key) => (dialog.querySelector(`[data-action=${key}]`).disabled = false),
      );
      status(
        t(
          'Render terminado. Ya puedes descargarlo.',
          'Render complete. Your file is ready to download.',
        ),
      );
    }
  });
  const backupBase = makeBackup;
  makeBackup = async function (list) {
    const backup = await backupBase(list);
    backup.motion = Core.normalize(draft);
    const included = new Set(backup.media.map((a) => a.id));
    for (const id of Core.references(draft)) {
      if (included.has(id)) continue;
      const asset = assets.find((a) => a.id === id);
      if (asset) {
        backup.media.push({
          id: asset.id,
          name: asset.name,
          type: asset.type,
          data: await dataURL(asset.blob),
        });
        included.add(id);
      }
    }
    if (backup.media.reduce((sum, a) => sum + a.data.length, 0) > 240 * 1024 * 1024)
      throw Error(t('Respaldo demasiado grande.', 'Backup too large.'));
    return backup;
  };
  const restoreBase = restoreCreatorBackup;
  restoreCreatorBackup = function (backup, restored, mediaIds) {
    restoreBase(backup, restored, mediaIds);
    if (backup.motion) {
      draft = Core.remap(backup.motion, mediaIds);
      save();
      if (dialog) {
        fill();
        loaded = false;
      }
    }
  };
  async function openWith(value = {}) {
    if (busy || preparing) {
      if (dialog)
        status(
          t('Espera a que termine el proceso actual.', 'Wait for the current process to finish.'),
        );
      return false;
    }
    draft = Core.normalize({
      ...draft,
      ...value,
      imageAsset: value.imageAsset || '',
      audioAsset: value.audioAsset || '',
      audioStart: value.audioStart || 0,
      code: value.code || '',
    });
    save();
    open();
    fill();
    if (engineReady) await loadDraft();
    return true;
  }
  window.FleremahiasMotion = { open, openWith };
  const button = document.createElement('button');
  button.className = 'motion-launch';
  button.textContent = 'Motion 2D / 3D';
  button.onclick = open;
  document.body.append(button);
})();
