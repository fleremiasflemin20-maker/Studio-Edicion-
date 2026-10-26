/* Workflow controller. Project edits stay local and undoable. */
(function (root) {
  const F = LumaFlowCore,
    M = LumaFlowMedia,
    tabNames = {
      create: 'Crear contenido',
      record: 'Grabar',
      text: 'Voz y texto',
      audio: 'Audio y ritmo',
      tracks: 'Pistas',
      design: 'Portadas y estilos',
      bulk: 'Tabla',
      review: 'Versiones',
      jobs: 'Exportar',
      publish: 'Publicar',
    };
  let state;
  try {
    state = JSON.parse(localStorage.getItem('luma-flow') || '{}');
  } catch {
    state = {};
  }
  state.service ||= 'https://luma-studio-service.analista-datos-pro.workers.dev';
  try {
    root.LumaFlowToken = sessionStorage.getItem('luma-service-token') || '';
  } catch {}
  state.recipes ||= [];
  state.jobs ||= [];
  state.jobs.forEach((j) => {
    if (j.status === 'Procesando') j.status = 'Interrumpido';
  });
  let modal,
    tab = 'create',
    busy = false,
    abort,
    recorder,
    stream,
    clock,
    selected = new Set(),
    ranges = [],
    beatTimes = [],
    beatAsset,
    clips = [],
    covers = [],
    queueRunning = false;
  const b = (label, action, value = '') =>
    `<button type="button" data-flow="${action}" data-value="${esc(value)}">${label}</button>`;
  const input = (id, value = '', type = 'text') =>
    `<input id="f-${id}" type="${type}" value="${esc(value)}">`;
  const field = (name, html) => `<label>${name}${html}</label>`;
  const sel = (id, options, value) =>
    `<select id="f-${id}">${options.map(([k, n]) => `<option value="${esc(k)}" ${k === value ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  const media = (types = 'image|video|audio') =>
    assets.filter((a) => new RegExp('^(' + types + ')').test(a.type)).map((a) => [a.id, a.name]);
  const value = (id) => $('#f-' + id)?.value || '';
  const persist = () => localStorage.setItem('luma-flow', JSON.stringify(state));
  function project() {
    if (!p()) throw Error('Abre o crea un proyecto');
    if (rendering || batchBusy) throw Error('Espera a que termine la exportación');
    return P.ensure(p());
  }
  const asset = (id) => {
    const a = assets.find((a) => a.id === id);
    if (!a) throw Error('Selecciona un archivo de la biblioteca');
    return a;
  };
  function status(t) {
    if ($('#flow-status')) $('#flow-status').textContent = t;
    else toast(t);
  }
  function close() {
    if (busy || recorder) return status('Cancela o termina el proceso antes de cerrar');
    modal?.close();
    modal?.remove();
    modal = null;
    if (view === 'editor' && p()) renderEditor();
    covers.forEach((c) => URL.revokeObjectURL(c.url));
    covers = [];
  }
  function open(t = 'create') {
    if (busy || recorder) return;
    LumaPro.close();
    modal?.remove();
    tab = t;
    modal = document.createElement('dialog');
    modal.className = 'flow-dialog';
    modal.setAttribute('aria-label', 'Centro de creación Fleremahias');
    modal.innerHTML = `<header><div><small>FLEREMAHIAS · DE TU IDEA A CADA RED</small><h2>Crear mi contenido.</h2></div>${b('Volver al estudio', 'close')}</header><nav class="flow-tabs">${Object.entries(
      tabNames,
    )
      .map(([id, n]) => b(n, 'tab', id))
      .join(
        '',
      )}</nav><section id="flow-body"></section><footer><span id="flow-status" role="status" aria-live="polite"></span>${b('Cancelar proceso', 'cancel')}</footer>`;
    modal.addEventListener('cancel', (e) => {
      e.preventDefault();
      close();
    });
    document.body.append(modal);
    modal.showModal();
    panel();
  }
  function panel() {
    const x = p();
    let html = '';
    if (!$('#flow-body')) return;
    modal
      .querySelectorAll('[data-flow="tab"]')
      .forEach((el) => el.classList.toggle('active', el.dataset.value === tab));
    if (tab === 'create')
      html = `<h3>Tu material. Una propuesta editable.</h3><p>Elige un objetivo, selecciona tus archivos en orden y crea un montaje que puedes ajustar después.</p><div class="flow-grid">${field('Nombre', input('name', x?.name || 'Mi próxima historia'))}${field(
        'Objetivo',
        sel(
          'goal',
          F.recipes.map((r) => [r.id, r.name]),
        ),
      )}${field(
        'Formato',
        sel('format', [
          ['9:16', 'Reel · TikTok · Short'],
          ['1:1', 'Post cuadrado'],
          ['16:9', 'Horizontal'],
          ['4:5', 'Post vertical'],
        ]),
      )}${field('Título o gancho', input('hook', 'Una idea para compartir'))}${field('Segundos por archivo', input('duration', 4, 'number'))}${field('Guion opcional · se distribuye, no se transcribe', '<textarea id="f-script"></textarea>')}</div><div class="flow-actions">${b('Importar material', 'import')}${b('Crear montaje editable', 'assemble')}</div><div class="flow-media-grid">${
        assets
          .filter((a) => /^(image|video)/.test(a.type))
          .map(
            (a) =>
              `<label><input type="checkbox" data-flow-select="${a.id}" ${selected.has(a.id) ? 'checked' : ''}>${a.type.startsWith('image') ? `<img src="${a.url}" alt="">` : '<span>▶</span>'}${esc(a.name)}</label>`,
          )
          .join('') || '<p>Importa imágenes o videos para empezar.</p>'
      }</div><small>Hasta 24 escenas y 120 segundos por montaje. Las grabaciones largas se dividen desde Voz y texto.</small>`;
    if (tab === 'record')
      html = `<h3>Graba sin salir de Fleremahias.</h3><p>El navegador solicitará acceso al dispositivo elegido. La toma se guarda en tu biblioteca.</p><div class="flow-grid">${field(
        'Fuente',
        sel('source', [
          ['camera', 'Cámara y micrófono'],
          ['screen', 'Pantalla y audio disponible'],
          ['audio', 'Solo micrófono'],
        ]),
      )}${field('Guion del teleprompter', '<textarea id="f-prompter"></textarea>')}</div><div class="flow-record"><video id="flow-record-video" autoplay muted playsinline></video><div id="flow-prompter"></div><strong id="flow-clock">Cuenta atrás de 3 segundos</strong></div><div class="flow-actions">${b('Iniciar grabación', 'record')}${b('Terminar y guardar toma', 'stop')}${b('Pausar / continuar guion', 'prompter')}</div>`;
    if (tab === 'text')
      html = `<h3>Edita lo que dices.</h3><p>Descarga un modelo de voz y procesa el audio en este dispositivo. Puede tardar varios minutos. Revisa nombres y tiempos.</p>${field('Grabación', sel('voice', media('video|audio'), x?.transcriptAsset || x?.asset))}${field(
        'Idioma',
        sel('language', [
          ['spanish', 'Español'],
          ['english', 'Inglés'],
          ['portuguese', 'Portugués'],
        ]),
      )}<div class="flow-actions">${b('Transcribir grabación', 'transcribe')}${b('Importar palabras JSON', 'words')}${b('Aplicar subtítulos a la escena', 'captions')}</div><small>JSON: [{text, start, end}], tiempos en segundos del archivo original. El audio no se sube a un servicio.</small><div id="flow-transcript">${transcript()}</div><div class="flow-actions">${b('Montar solo frases marcadas', 'text-cut')}${b('Proponer clips por frases', 'clips')}${b('Resaltar posibles muletillas', 'fillers')}</div><div id="flow-clips"></div>`;
    if (tab === 'audio')
      html = `<h3>Ritmo y voz bajo control.</h3>${field('Archivo', sel('audio', media('video|audio'), x?.asset || x?.audio))}<div class="flow-actions">${b('Detectar pausas de la escena', 'silence')}${b('Aplicar pausas marcadas', 'apply-silence')}${b('Mejorar voz de la escena', 'voice')}${b('Detectar golpes musicales', 'beats')}${b('Ajustar escenas al ritmo', 'apply-beats')}</div><p>Mejorar voz aplica filtros, compresión, atenuación suave de señal débil y normalización. No es separación de voz por IA. Revisa los cortes antes de aplicarlos.</p><div id="flow-analysis"></div>`;
    if (tab === 'tracks')
      html = `<h3>Más de una imagen, una historia.</h3><p>Los videos superpuestos se añaden sin audio. Añade su archivo también como pista si lo necesitas.</p><div class="flow-grid">${field('Archivo', sel('track', media()))}${field('Desde (escena para video; montaje para audio)', input('from', 0, 'number'))}${field('Hasta (0 = final)', input('to', 0, 'number'))}${field('Inicio en el archivo original', input('source-start', 0, 'number'))}</div><div class="flow-actions">${b('Añadir video / imagen', 'visual')}${b('Añadir audio', 'add-audio')}${b('Diseño reacción', 'layout', 'reaction')}${b('Pantalla dividida', 'layout', 'split')}${b('Seguir rostro', 'face')}${b('Quitar seguimiento', 'unface')}</div><div class="flow-tracks">${(x?.layers || []).map((l) => `<article>${b((selected.has(l.id) ? '✓ ' : '') + esc(l.kind) + ' · ' + esc(l.text || 'Capa'), 'select', l.id)}<span>${l.startAt || 0}–${l.endAt || P.length(x)} s</span>${b(l.hidden ? 'Mostrar' : 'Ocultar', 'hide', l.id)}</article>`).join('')}<h4>Audio del montaje</h4>${(x?.audioTracks || []).map((t) => `<article>${esc(assets.find((a) => a.id === t.asset)?.name || 'Archivo ausente')} · ${t.at}–${t.end || 'fin'} s<label>Volumen<input type="number" min="0" max="2" step=".1" data-track-volume="${t.id}" value="${t.volume}"></label>${b('Quitar', 'remove-audio', t.id)}</article>`).join('')}</div><div class="flow-actions">${b('Seleccionar todas las capas', 'select-all')}${b('Agrupar', 'group')}${b('Desagrupar', 'ungroup')}${b('Centrar selección', 'align')}</div><p>Shift + clic selecciona varias capas. Usa el tirador inferior para tamaño y el superior para giro. Arrastrar una capa agrupada mueve el conjunto.</p>`;
    if (tab === 'design')
      html = `<h3>Tu estilo, repetible.</h3><div class="flow-grid">${field('Título de portada', input('title', x?.name || 'Tu próxima idea'))}${field(
        'Receta completa',
        sel(
          'recipe',
          [...F.recipes, ...state.recipes].map((r) => [r.id, r.name]),
        ),
      )}${field('Nombre de tu receta', input('recipe-name', 'Mi estilo'))}${field(
        'Zona segura',
        sel('safe', [
          ['reels', 'Reels'],
          ['tiktok', 'TikTok'],
        ]),
      )}</div><div class="flow-actions">${b('Crear tres portadas', 'covers')}${b('Aplicar receta a todo', 'recipe')}${b('Guardar mi receta', 'save-recipe')}${b('Ajustar zonas seguras', 'safe')}${b('Crear tres versiones', 'variants')}${b('Preparar campaña', 'campaign')}</div><div id="flow-covers" class="flow-covers"></div>`;
    if (tab === 'bulk')
      html = `<h3>Una tabla. Muchas piezas.</h3><p>Usa {{titulo}}, {{precio}}, {{cta}} en los textos del proyecto. La columna imagen debe coincidir con el nombre de un archivo de la biblioteca.</p><textarea id="f-csv" rows="7">titulo,precio,cta,imagen\nMi producto,19.90,Descúbrelo hoy,\nOtra idea,29.90,Guárdalo para después,</textarea><div class="flow-actions">${b('Importar CSV', 'csv-file')}${b('Ver vista previa', 'csv-preview')}${b('Generar proyectos', 'csv-generate')}</div><div id="flow-table"></div><small>Máximo 50 filas. Sin variables en el título, usamos el valor de la columna titulo.</small>`;
    if (tab === 'review')
      html = `<h3>Revisa sin perder lo anterior.</h3><div class="flow-grid">${field('Nombre de versión', input('version', 'Versión ' + new Date().toLocaleTimeString('es')))}${field('Nota', input('note'))}${field('Segundo del montaje', input('time', 0, 'number'))}</div><div class="flow-actions">${b('Guardar versión', 'snapshot')}${b('Añadir nota', 'note')}${b('Comparar dos videos', 'compare')}</div><div class="flow-grid"><section><h4>Versiones locales</h4>${(x?.flowVersions || []).map((v) => `<article><strong>${esc(v.name)}</strong>${b('Abrir copia editable', 'restore', v.id)}</article>`).join('') || 'Sin versiones guardadas'}</section><section><h4>Notas con tiempo</h4>${(x?.flowNotes || []).map((n) => `<article>${b(n.time.toFixed(1) + ' s', 'seek', n.time)}${esc(n.text)}${b(n.done ? 'Reabrir' : 'Resolver', 'resolve', n.id)}</article>`).join('') || 'Sin notas'}</section></div><div id="flow-compare"></div>`;
    if (tab === 'jobs')
      html = `<h3>Exportaciones recuperables.</h3><p>Esta cola funciona en el navegador. Mantén Fleremahias visible. Puedes reintentar una tarea interrumpida. Para trabajos con la pestaña cerrada hace falta el servicio externo.</p><div class="flow-actions">${b('Añadir proyecto', 'enqueue')}${b('Procesar pendientes', 'run')}${b('Detener después de la actual', 'stop-queue')}${b('Enviar proyecto al servidor', 'remote-job')}${b('Actualizar trabajos remotos', 'remote-status')}<div id="flow-remote"></div></div>${state.jobs.map((j) => `<article><strong>${esc(j.name)}</strong><small>${esc(j.status)} ${esc(j.error || '')}</small>${j.asset ? b('Descargar', 'download-job', j.id) : b('Reintentar', 'retry', j.id)}</article>`).join('')}`;
    if (tab === 'publish')
      html = `<h3>Del montaje a la publicación.</h3><p>La preparación local ya funciona. La publicación programada necesita un servicio propio y cuentas autorizadas. GitHub Pages no ejecuta estos trabajos.</p><div class="flow-grid">${field('Servicio HTTPS o localhost', input('service', state.service || ''))}${field('Token del servicio · solo esta sesión', input('token', '', 'password'))}</div><div class="flow-actions">${b('Comprobar servicio', 'connect')}${b('Abrir preparación para redes', 'publish-local')}</div><div id="flow-accounts"></div><section id="flow-post" hidden>${field('Cuenta', sel('account', []))}${field('Video final', sel('final', media('video')))}${field('Descripción', '<textarea id="f-caption">' + esc(x?.caption || '') + '</textarea>')}${field(
        'Visibilidad de YouTube',
        sel('privacy', [
          ['private', 'Privado'],
          ['unlisted', 'No listado'],
          ['public', 'Público'],
        ]),
      )}${field(
        '¿Dirigido a niños? · YouTube',
        sel('kids', [
          ['no', 'No'],
          ['yes', 'Sí'],
        ]),
      )}${field('Fecha opcional · hora local', input('date', '', 'datetime-local'))}${b('Revisar envío', 'review-post')}<div id="flow-send"></div></section><p>Las cuentas se autorizan en la página oficial de cada red. Servicio para Cloudflare Workers, R2 y Browser Run: instrucciones en cloudflare/README.md del repositorio.</p>`;
    $('#flow-body').innerHTML = html;
  }
  function transcript() {
    const w = p()?.transcript || [];
    let html = '';
    for (let i = 0; i < w.length; i += 5) {
      const s = w.slice(i, i + 5);
      html += `<label class="flow-word-row"><input type="checkbox" data-word="${i}" checked><span>${s[0].start.toFixed(2)}–${s.at(-1).end.toFixed(2)} s</span><input aria-label="Frase ${i / 5 + 1}" data-word-edit="${i}" value="${esc(s.map((q) => q.text).join(' '))}"></label>`;
    }
    return html || '<p>Transcribe o importa palabras con tiempos para empezar.</p>';
  }
  function make(name, scenes, format = '9:16', caption = '') {
    if (!scenes.length) throw Error('No hay escenas');
    const x = {
      id: crypto.randomUUID(),
      name: String(name).slice(0, 100),
      format,
      platform: format === '16:9' ? 'YouTube' : 'Instagram',
      caption,
      status: 'Borrador',
      created: Date.now(),
      scenes,
      activeScene: scenes[0].id,
      volume: 1,
      musicVolume: 0.2,
      musicLoop: true,
      ducking: true,
      audioTracks: [],
    };
    P.activate(x, x.activeScene, false);
    projects.unshift(x);
    return x;
  }
  function clone(x, name) {
    const c = structuredClone(x);
    delete c.flowVersions;
    c.id = crypto.randomUUID();
    c.name = name;
    c.created = Date.now();
    c.scenes = c.scenes.map(P.scene);
    c.activeScene = c.scenes[0].id;
    P.activate(c, c.activeScene, false);
    projects.unshift(c);
    return c;
  }
  function enter(x) {
    busy = false;
    close();
    current = x.id;
    save();
    go('editor');
  }
  async function file(accept, handler) {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.onchange = async () => {
      try {
        if (i.files[0]) await handler(i.files[0]);
      } catch (e) {
        status(e.message);
      }
    };
    i.hidden = true;
    document.body.append(i);
    i.click();
  }
  async function remoteJob() {
    const x = project();
    P.mirror(x);
    if (!state.service || !root.LumaFlowToken)
      throw Error('Conecta tu servicio en Publicar primero');
    const media = [];
    for (const id of P.references(x)) {
      const a = asset(id);
      status('Subiendo ' + a.name);
      const remote = await request('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': a.type, 'X-Filename': encodeURIComponent(a.name) },
        body: a.blob,
      });
      media.push({ local: id, remote: remote.id, name: a.name });
    }
    const job = await request('/api/renders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: x, media }),
    });
    status('Trabajo remoto ' + job.id + ' · ' + job.status + '. Ya puedes cerrar la pestaña.');
  }
  async function remoteStatus() {
    const data = await request('/api/status');
    $('#flow-remote').innerHTML =
      (data.renders || [])
        .map(
          (r) =>
            '<article>' +
            esc(r.id) +
            ' · ' +
            esc(r.status) +
            ' ' +
            esc(r.error || '') +
            (r.output ? b('Descargar resultado', 'remote-download', r.output) : '') +
            '</article>',
        )
        .join('') +
      (data.posts || [])
        .map(
          (p) =>
            '<article>' +
            esc(p.status) +
            ' · ' +
            esc(p.note || p.error || '') +
            (p.url
              ? '<a target="_blank" rel="noopener" href="' + esc(p.url) + '">Abrir publicación</a>'
              : '') +
            '</article>',
        )
        .join('');
  }
  const actions = {
    'remote-job': remoteJob,
    'remote-status': remoteStatus,
    'remote-download': async (id) => {
      const res = await fetch(state.service + '/api/media/' + encodeURIComponent(id), {
        headers: { Authorization: 'Bearer ' + root.LumaFlowToken },
      });
      if (!res.ok) throw Error('Archivo remoto no disponible');
      download(await res.blob(), 'Fleremahias-exportacion.webm');
    },
    close: () => {
      busy = false;
      close();
    },
    tab: (t) => {
      tab = t;
      panel();
    },
    cancel: () => {
      abort?.abort();
      if (recorder?.state === 'recording') recorder.stop();
      else stream?.getTracks().forEach((t) => t.stop());
    },
    import: () => {
      const i = document.createElement('input');
      i.type = 'file';
      i.multiple = true;
      i.accept = 'image/*,video/*,audio/*';
      i.onchange = async () => {
        try {
          for (const f of i.files) {
            if (!/^(image|video|audio)\//.test(f.type)) continue;
            const a = await storeAsset(f, f.name);
            if (!a.type.startsWith('audio')) selected.add(a.id);
          }
          panel();
        } catch (e) {
          status(e.message);
        }
      };
      i.hidden = true;
      document.body.append(i);
      i.click();
    },
    assemble: async () => {
      const ids = [...selected].filter((id) =>
          assets.some((a) => a.id === id && /^(video|image)/.test(a.type)),
        ),
        seconds = Math.max(1, Math.min(30, +value('duration') || 4));
      if (!ids.length) throw Error('Selecciona archivos');
      if (ids.length > 24 || ids.length * seconds > 120)
        throw Error('Reduce los archivos o duración: máximo 24 escenas y 120 segundos');
      const r = F.recipes.find((r) => r.id === value('goal')),
        scenes = [];
      for (const id of ids) {
        const a = asset(id);
        let duration = 4;
        if (a.type.startsWith('video')) {
          const v = await M.video(a);
          duration = v.duration;
          v.removeAttribute('src');
          v.load();
          if (!Number.isFinite(duration)) throw Error('No se pudo leer la duración');
        }
        scenes.push(
          F.applyRecipe(
            P.scene({
              name: a.name,
              asset: id,
              sourceDuration: a.type.startsWith('video') ? duration : 0,
              end: a.type.startsWith('video') ? Math.min(seconds, duration) : 0,
              duration: seconds,
              text: scenes.length ? '' : value('hook'),
              motion: a.type.startsWith('image') ? 'zoom-in' : 'none',
            }),
            r,
          ),
        );
      }
      if (value('script').trim())
        scenes[0].subtitles = LumaProCore.timedCaptions(value('script'), P.length(scenes[0]), 5);
      enter(make(value('name') || 'Mi contenido', scenes, value('format')));
    },
    transcribe: async () => {
      const x = project(),
        a = asset(value('voice')),
        language = value('language');
      status('Decodificando audio…');
      const buffer = await M.decode(a);
      if (buffer.duration > 1800) throw Error('Divide grabaciones de más de 30 minutos');
      const words = await M.transcribe(
        new Float32Array(buffer.getChannelData(0)),
        language,
        status,
        abort.signal,
      );
      x.transcript = F.normalizeWords(words, buffer.duration);
      x.transcriptAsset = a.id;
      save();
      panel();
      status('Transcripción lista. Revisa nombres y tiempos.');
    },
    words: () =>
      file('.json', async (f) => {
        const x = project(),
          data = JSON.parse(await f.text());
        const words = F.normalizeWords(data.words || data);
        if (!words.length) throw Error('No hay palabras con tiempos válidos');
        x.transcript = words;
        x.transcriptAsset = value('voice');
        save();
        panel();
        status('Palabras importadas');
      }),
    captions: () => {
      const x = project();
      if (x.transcriptAsset !== x.asset)
        throw Error(
          'La transcripción pertenece a otro archivo. Monta las frases como proyecto nuevo.',
        );
      const start = x.start || 0,
        end = x.end || x.sourceDuration,
        speed = x.speed || 1;
      x.words = (x.transcript || [])
        .filter((w) => w.end > start && w.start < end)
        .map((w) => ({
          ...w,
          start: Math.max(0, (w.start - start) / speed),
          end: Math.min(P.length(x), (w.end - start) / speed),
        }));
      if (!x.words.length) throw Error('No hay palabras para este recorte');
      x.subtitles = F.wordsToSrt(x.words);
      x.subtitleStyle = 'karaoke';
      save();
      status('Subtítulos aplicados con tiempos de voz.');
    },
    'text-cut': () => {
      const x = project(),
        checks = [...modal.querySelectorAll('[data-word]:checked')];
      if (!checks.length || checks.length > 24) throw Error('Marca entre 1 y 24 frases');
      const scenes = checks.map((el) =>
        wordScene(x, x.transcript.slice(+el.dataset.word, +el.dataset.word + 5)),
      );
      if (P.layout(scenes).at(-1).end > 120) throw Error('Selecciona menos de 120 segundos');
      enter(make(x.name + ' · edición por texto', scenes, x.format, x.caption));
    },
    clips: () => {
      const x = project();
      clips = F.candidates(x.transcript || []);
      $('#flow-clips').innerHTML =
        clips
          .map(
            (c, i) =>
              `<article><strong>${c.start.toFixed(1)}–${c.end.toFixed(1)} s</strong><p>${esc(c.text)}</p><small>${esc(c.reason)}</small>${b('Crear clip editable', 'clip', i)}</article>`,
          )
          .join('') || '<p>Transcribe primero.</p>';
    },
    clip: (i) => {
      const x = project(),
        c = clips[+i];
      if (!c) throw Error('Clip no encontrado');
      make(
        x.name + ' · clip ' + (+i + 1),
        [
          wordScene(
            x,
            x.transcript.filter((w) => w.start >= c.start && w.end <= c.end),
          ),
        ],
        x.format,
      );
      save();
      status('Clip creado en Mis proyectos.');
    },
    fillers: () => {
      let count = 0;
      modal.querySelectorAll('[data-word-edit]').forEach((el) => {
        el.classList.toggle('flow-warning', /\b(eh|em|este|mmm|um|uh)\b/i.test(el.value));
        if (el.classList.contains('flow-warning')) count++;
      });
      status(count + ' frases con posibles muletillas. Revisa antes de cortar.');
    },
    silence: async () => {
      const x = project(),
        a = asset(value('audio'));
      if (a.id !== x.asset) throw Error('Selecciona el archivo principal de la escena');
      const buf = await M.decode(a),
        end = x.end || buf.duration,
        samples = buf
          .getChannelData(0)
          .slice((x.start || 0) * buf.sampleRate, end * buf.sampleRate);
      ranges = F.silence(samples, buf.sampleRate).map((r) => ({
        start: r.start / (x.speed || 1),
        end: r.end / (x.speed || 1),
      }));
      $('#flow-analysis').innerHTML =
        '<h4>Pausas propuestas</h4>' +
        ranges
          .map(
            (r, i) =>
              `<label><input type="checkbox" data-pause="${i}" checked>${r.start.toFixed(2)}–${r.end.toFixed(2)} s</label>`,
          )
          .join('');
      status(
        ranges.length ? 'Revisa y aplica los cortes deseados.' : 'No se detectaron pausas largas.',
      );
    },
    'apply-silence': () => {
      const x = project(),
        removed = [...modal.querySelectorAll('[data-pause]:checked')].map(
          (el) => ranges[+el.dataset.pause],
        );
      if (!removed.length) throw Error('Analiza y marca pausas primero');
      const keep = F.keepRanges(P.length(x), removed);
      if (!keep.length) throw Error('Los cortes eliminarían toda la escena');
      P.mirror(x);
      const scenes = keep.map((r) => F.slice(x, r.start, r.end));
      if (x.scenes.length - 1 + scenes.length > 24) throw Error('Selecciona menos pausas');
      const i = x.scenes.findIndex((s) => s.id === x.activeScene);
      x.scenes.splice(i, 1, ...scenes);
      P.activate(x, scenes[0].id, false);
      save();
      remember();
      status('Pausas acortadas. Puedes deshacer en el editor.');
    },
    voice: async () => {
      const x = project();
      P.mirror(x);
      const timing = P.layout(x.scenes),
        i = x.scenes.findIndex((s) => s.id === x.activeScene);
      status('Procesando voz…');
      const blob = await M.improve(asset(x.asset), x.start || 0, x.end || 0),
        a = await storeAsset(blob, x.name + ' · voz mejorada.wav');
      x.audioTracks ||= [];
      x.audioTracks.push({
        id: crypto.randomUUID(),
        asset: a.id,
        at: timing[i].start,
        end: timing[i].end,
        sourceStart: 0,
        speed: x.speed || 1,
        volume: 1,
      });
      x.muted = true;
      save();
      status('Voz procesada añadida como pista; audio original de la escena silenciado.');
    },
    beats: async () => {
      const a = asset(value('audio')),
        buf = await M.decode(a);
      beatTimes = F.beats(buf.getChannelData(0), buf.sampleRate);
      beatAsset = a.id;
      $('#flow-analysis').innerHTML =
        '<p>' +
        beatTimes.length +
        ' golpes: ' +
        beatTimes
          .slice(0, 24)
          .map((t) => t.toFixed(2) + ' s')
          .join(' · ') +
        '</p>';
      status('Detección por energía. Escucha los puntos antes de aplicar.');
    },
    'apply-beats': () => {
      const x = project();
      if (beatTimes.length < 2) throw Error('Analiza una pista con golpes claros');
      P.mirror(x);
      let t = 0;
      x.scenes = x.scenes.map((s) => {
        const end = beatTimes.find((b) => b > t + 0.7) || t + 2,
          d = Math.min(P.length(s), end - t),
          c = F.slice(s, 0, d);
        t += d;
        return c;
      });
      x.audio = beatAsset;
      P.activate(x, x.scenes[0].id, false);
      save();
      status('Escenas ajustadas a los golpes detectados.');
    },
    visual: () => addTrack(false),
    'add-audio': () => addTrack(true),
    layout: (v) => {
      const x = project(),
        l = x.layers.filter((l) => ['image', 'video'].includes(l.kind)).at(-1);
      if (!l) throw Error('Añade una capa visual primero');
      Object.assign(
        l,
        v === 'split'
          ? { x: 50, y: 26, width: 100, height: 48 }
          : { x: 76, y: 28, width: 37, height: 28 },
      );
      save();
      status('Diseño aplicado a la última capa visual.');
    },
    face: async () => {
      const x = project(),
        a = asset(x.asset);
      if (!a.type.startsWith('video')) throw Error('Selecciona una escena con video');
      status('Descargando detector facial…');
      x.facePath = await M.faces(a, x, x.format, status, abort.signal);
      save();
      status('Seguimiento guardado: ' + x.facePath.length + ' posiciones.');
    },
    unface: () => {
      project().facePath = [];
      save();
      status('Seguimiento quitado');
    },
    select: (id) => {
      selected.has(id) ? selected.delete(id) : selected.add(id);
      panel();
    },
    hide: (id) => {
      const l = project().layers.find((l) => l.id === id);
      l.hidden = !l.hidden;
      save();
      panel();
    },
    'remove-audio': (id) => {
      const x = project();
      x.audioTracks = x.audioTracks.filter((t) => t.id !== id);
      save();
      panel();
    },
    'select-all': () => {
      selected = new Set(project().layers.map((l) => l.id));
      panel();
    },
    group: () => {
      const id = crypto.randomUUID();
      project()
        .layers.filter((l) => selected.has(l.id))
        .forEach((l) => (l.group = id));
      save();
      status('Capas agrupadas');
    },
    ungroup: () => {
      project()
        .layers.filter((l) => selected.has(l.id))
        .forEach((l) => (l.group = ''));
      save();
      status('Capas desagrupadas');
    },
    align: () => {
      project()
        .layers.filter((l) => selected.has(l.id))
        .forEach((l) => {
          l.x = 50;
          l.y = 50;
        });
      save();
      status('Selección centrada');
    },
    covers: async () => {
      const x = project(),
        title = value('title'),
        media = previewMedia?.readyState >= 2 ? previewMedia : imageObj;
      if (x.asset && !media) throw Error('Vuelve al editor y espera a que cargue el medio');
      covers.forEach((c) => URL.revokeObjectURL(c.url));
      covers = [];
      for (const [i, style] of ['poster', 'editorial', 'boxed'].entries()) {
        const c = document.createElement('canvas');
        c.width = 1080;
        c.height = 1920;
        const s = P.scene({
          ...x,
          text: title,
          fontSize: 104,
          textY: i === 1 ? 72 : 50,
          titleStyle: style,
          layers: [],
          subtitles: '',
          color: '#ffffff',
        });
        LumaCompositor.paint(c.getContext('2d'), s, media, previewSeconds || 1, assetImages);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        covers.push({
          blob,
          url: URL.createObjectURL(blob),
          name: x.name + '-portada-' + (i + 1) + '.png',
        });
      }
      $('#flow-covers').innerHTML = covers
        .map(
          (c, i) =>
            `<article><img src="${c.url}" alt="Portada ${i + 1}">${b('Descargar PNG', 'cover-download', i)}${b('Guardar en biblioteca', 'cover-store', i)}</article>`,
        )
        .join('');
      status('Tres portadas listas.');
    },
    'cover-download': (i) => download(covers[+i].blob, covers[+i].name),
    'cover-store': async (i) => {
      await storeAsset(covers[+i].blob, covers[+i].name);
      status('Portada guardada');
    },
    recipe: () => {
      const x = project(),
        r = [...F.recipes, ...state.recipes].find((r) => r.id === value('recipe'));
      P.mirror(x);
      x.scenes.forEach((s) => F.applyRecipe(s, r));
      P.activate(x, x.activeScene, false);
      save();
      status('Receta aplicada a todas las escenas');
    },
    'save-recipe': () => {
      const x = project(),
        r = { id: crypto.randomUUID(), name: value('recipe-name').slice(0, 60) || 'Mi estilo' };
      for (const k of recipeKeys) r[k] = x[k];
      state.recipes.push(r);
      state.recipes = state.recipes.slice(-30);
      persist();
      panel();
      status('Receta guardada');
    },
    safe: () => {
      const x = project();
      P.mirror(x);
      x.scenes.forEach((s) => F.safe(s, value('safe')));
      P.activate(x, x.activeScene, false);
      save();
      status('Zonas conservadoras aplicadas. Revisa los textos largos.');
    },
    variants: () => {
      const x = project();
      P.mirror(x);
      ['Lo que necesitas saber: ', 'Tres claves sobre ', 'Otra forma de ver '].forEach(
        (hook, i) => {
          const copy = clone(x, x.name + ' · versión ' + (i + 1));
          copy.scenes[0].text = hook + (x.text || x.name);
          F.applyRecipe(copy.scenes[0], F.recipes[i]);
          P.activate(copy, copy.activeScene, false);
        },
      );
      save();
      status('Tres propuestas creadas en Mis proyectos');
    },
    campaign: () => {
      project();
      busy = false;
      close();
      queueCurrent();
      go('publish');
    },
    'csv-file': () =>
      file('.csv,.tsv,.txt', async (f) => {
        $('#f-csv').value = await f.text();
        previewTable();
      }),
    'csv-preview': previewTable,
    'csv-generate': () => {
      const x = project(),
        rows = F.csv(value('csv'));
      P.mirror(x);
      const generated = rows.map((row, i) => {
        const c = structuredClone(x);
        delete c.flowVersions;
        c.id = crypto.randomUUID();
        c.name = String(row.titulo || x.name + ' ' + (i + 1)).slice(0, 100);
        c.caption = F.fill(x.caption, row);
        c.scenes = c.scenes.map((s) => {
          const n = P.scene(s);
          n.text = F.fill(s.text.includes('{{') ? s.text : row.titulo ? '{{titulo}}' : s.text, row);
          n.layers.forEach((l) => (l.text = F.fill(l.text, row)));
          if (row.imagen) {
            const a = assets.find((a) => a.name === row.imagen && a.type.startsWith('image'));
            if (!a) throw Error('Imagen no encontrada: ' + row.imagen);
            n.asset = a.id;
            n.start = 0;
            n.end = 0;
            n.sourceDuration = 0;
          }
          return n;
        });
        c.activeScene = c.scenes[0].id;
        P.activate(c, c.activeScene, false);
        return c;
      });
      projects.unshift(...generated);
      save();
      status(generated.length + ' proyectos creados');
    },
    snapshot: () => {
      const x = project();
      P.mirror(x);
      const data = structuredClone(x);
      delete data.flowVersions;
      x.flowVersions ||= [];
      x.flowVersions.push({
        id: crypto.randomUUID(),
        name: value('version').slice(0, 80),
        at: Date.now(),
        data,
      });
      x.flowVersions = x.flowVersions.slice(-8);
      save();
      panel();
    },
    restore: (id) => {
      const x = project(),
        v = x.flowVersions?.find((v) => v.id === id);
      if (!v) throw Error('Versión ausente');
      clone(v.data, x.name + ' · ' + v.name);
      save();
      status('Copia restaurada en Mis proyectos');
    },
    note: () => {
      const x = project(),
        text = value('note').trim();
      if (!text) throw Error('Escribe una nota');
      x.flowNotes ||= [];
      x.flowNotes.push({
        id: crypto.randomUUID(),
        text: text.slice(0, 1000),
        time: Math.max(0, Math.min(P.layout(x.scenes).at(-1).end, +value('time') || 0)),
        done: false,
      });
      x.flowNotes = x.flowNotes.slice(-200);
      save();
      panel();
    },
    resolve: (id) => {
      const n = project().flowNotes.find((n) => n.id === id);
      n.done = !n.done;
      save();
      panel();
    },
    seek: (time) => {
      const x = project(),
        layout = P.layout(x.scenes),
        i = P.locate(+time, layout),
        t = +time - layout[i].start;
      P.activate(x, x.scenes[i].id);
      busy = false;
      close();
      renderEditor();
      previewSeconds = t;
      if (previewMedia) previewMedia.currentTime = x.start + t * (x.speed || 1);
      draw();
    },
    compare: () => {
      const a = assets.filter((a) => a.type.startsWith('video'));
      if (a.length < 2) throw Error('Guarda dos videos o exportaciones en la biblioteca');
      $('#flow-compare').innerHTML =
        '<p>Los dos últimos videos de la biblioteca</p><div class="flow-compare">' +
        a
          .slice(-2)
          .map(
            (a) =>
              `<section><h4>${esc(a.name)}</h4><video controls playsinline src="${a.url}"></video></section>`,
          )
          .join('') +
        '</div>';
    },
    record,
    stop: () => {
      if (recorder?.state === 'recording') recorder.stop();
    },
    prompter: () => {
      const el = $('#flow-prompter');
      if (el) el.dataset.paused = el.dataset.paused ? '' : '1';
    },
    enqueue: () => {
      const x = project();
      P.mirror(x);
      state.jobs.push({
        id: crypto.randomUUID(),
        projectId: x.id,
        name: x.name,
        status: 'Pendiente',
        fingerprint: projectFingerprint(x),
      });
      state.jobs = state.jobs.slice(-50);
      persist();
      panel();
    },
    run: runJobs,
    'stop-queue': () => {
      queueRunning = false;
      status('La cola terminará después de la tarea actual');
    },
    retry: (id) => {
      const j = state.jobs.find((j) => j.id === id);
      j.status = 'Pendiente';
      j.fingerprint = projectFingerprint(projects.find((x) => x.id === j.projectId) || {});
      persist();
      panel();
    },
    'download-job': (id) => {
      const j = state.jobs.find((j) => j.id === id),
        a = asset(j.asset);
      download(a.blob, a.name);
    },
    'clear-remote': async () => {
      if (
        !confirm(
          '¿Eliminar definitivamente los archivos temporales del servicio? Las cuentas y tus proyectos del navegador se conservan.',
        )
      )
        return;
      await request('/api/temporary/clear', { method: 'POST' });
      status('Archivos temporales eliminados');
    },
    connect,
    'publish-local': () => {
      busy = false;
      close();
      go('publish');
    },
    oauth,
    'review-post': reviewPost,
    'send-post': sendPost,
  };
  const recipeKeys = [
    'titleStyle',
    'subtitleStyle',
    'filter',
    'transition',
    'bg',
    'color',
    'font',
    'fontSize',
    'background',
  ];
  function wordScene(x, words) {
    if (!words.length) throw Error('No hay palabras');
    asset(x.transcriptAsset);
    const s = P.scene({
      name: words
        .map((w) => w.text)
        .join(' ')
        .slice(0, 50),
      asset: x.transcriptAsset,
      start: words[0].start,
      end: words.at(-1).end,
      sourceDuration: x.transcript.at(-1).end,
      transition: 'cut',
      text: '',
    });
    s.words = words.map((w) => ({ ...w, start: w.start - s.start, end: w.end - s.start }));
    s.subtitles = F.wordsToSrt(s.words);
    return s;
  }
  function addTrack(audio) {
    const x = project(),
      a = asset(value('track')),
      at = Math.max(0, +value('from') || 0),
      end = Math.max(0, +value('to') || 0),
      sourceStart = Math.max(0, +value('source-start') || 0);
    if (end && end <= at) throw Error('El final debe superar el inicio');
    if (audio) {
      if (!/^(video|audio)/.test(a.type)) throw Error('Selecciona audio o video');
      x.audioTracks ||= [];
      if (x.audioTracks.length >= 12) throw Error('Máximo 12 pistas');
      x.audioTracks.push({
        id: crypto.randomUUID(),
        asset: a.id,
        at,
        end,
        sourceStart,
        volume: 1,
        speed: 1,
      });
    } else {
      if (!/^(video|image)/.test(a.type)) throw Error('Selecciona una imagen o video');
      if (x.layers.length >= 40) throw Error('Máximo 40 capas');
      x.layers.push(
        P.layer({
          kind: a.type.startsWith('video') ? 'video' : 'image',
          text: a.name,
          asset: a.id,
          width: 40,
          height: 30,
          x: 72,
          y: 30,
          startAt: at,
          endAt: end,
          sourceStart,
        }),
      );
    }
    save();
    panel();
  }
  function previewTable() {
    const rows = F.csv(value('csv'));
    $('#flow-table').innerHTML =
      '<p>' +
      rows.length +
      ' piezas · primeras 8 filas</p><table><thead><tr>' +
      Object.keys(rows[0])
        .map((k) => '<th>' + esc(k) + '</th>')
        .join('') +
      '</tr></thead><tbody>' +
      rows
        .slice(0, 8)
        .map(
          (r) =>
            '<tr>' +
            Object.values(r)
              .map((v) => '<td>' + esc(v) + '</td>')
              .join('') +
            '</tr>',
        )
        .join('') +
      '</tbody></table>';
  }
  async function record() {
    const source = value('source'),
      script = value('prompter');
    stream =
      source === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getUserMedia({ video: source === 'camera', audio: true });
    $('#flow-record-video').srcObject = stream;
    $('#flow-prompter').textContent = script;
    for (let n = 3; n > 0; n--) {
      status('Grabación en ' + n);
      await new Promise((r) => setTimeout(r, 1000));
      if (abort.signal.aborted) {
        stream.getTracks().forEach((t) => t.stop());
        throw Error('Grabación cancelada');
      }
    }
    const chunks = [],
      mime =
        source === 'audio'
          ? ['audio/webm;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t))
          : recorderType();
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    const currentRecorder = recorder,
      started = Date.now();
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      clearInterval(clock);
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      recorder = null;
      try {
        const blob = new Blob(chunks, { type: currentRecorder.mimeType }),
          a = await storeAsset(
            blob,
            'Toma ' +
              new Date().toISOString().replace(/[:.]/g, '-') +
              (blob.type.includes('mp4') ? '.mp4' : '.webm'),
          );
        if ($('#flow-record-video')) {
          $('#flow-record-video').srcObject = null;
          $('#flow-record-video').src = a.url;
          $('#flow-record-video').controls = true;
        }
        status('Toma guardada en la biblioteca. Abre Crear contenido para montarla.');
      } catch (e) {
        status(e.message);
      }
    };
    recorder.start(1000);
    stream.getVideoTracks().forEach(
      (t) =>
        (t.onended = () => {
          if (recorder?.state === 'recording') recorder.stop();
        }),
    );
    let scroll = 0;
    clock = setInterval(() => {
      if ($('#flow-clock'))
        $('#flow-clock').textContent = '● ' + Math.floor((Date.now() - started) / 1000) + ' s';
      const el = $('#flow-prompter');
      if (el && !el.dataset.paused) {
        scroll += 1;
        el.scrollTop = scroll;
      }
    }, 100);
    status('Grabando. Termina con el botón o el control de compartir pantalla.');
  }
  async function runJobs() {
    if (queueRunning) throw Error('La cola ya está funcionando');
    queueRunning = true;
    busy = false;
    close();
    for (const j of state.jobs.filter((j) =>
      ['Pendiente', 'Error', 'Interrumpido'].includes(j.status),
    )) {
      if (!queueRunning) break;
      try {
        const x = projects.find((x) => x.id === j.projectId);
        if (!x) throw Error('Proyecto no encontrado');
        if (projectFingerprint(x) !== j.fingerprint)
          throw Error('El proyecto cambió. Reintenta para usar su versión actual.');
        current = x.id;
        go('editor');
        j.status = 'Procesando';
        persist();
        const out = await exportVideo({ download: false, throwErrors: true });
        if (!out) throw Error('No se generó un video');
        const a = await storeAsset(out.blob, out.name);
        j.asset = a.id;
        j.status = 'Terminado';
        delete j.error;
      } catch (e) {
        j.status = 'Error';
        j.error = e.message;
      }
      persist();
    }
    queueRunning = false;
    open('jobs');
  }
  async function request(path, options = {}) {
    if (!state.service) throw Error('Configura tu servicio');
    const r = await fetch(
      state.service +
        path +
        (!options.method ? (path.includes('?') ? '&' : '?') + '_luma=' + Date.now() : ''),
      {
        ...options,
        headers: { ...options.headers, Authorization: 'Bearer ' + root.LumaFlowToken },
      },
    );
    const data = await r.json();
    if (!r.ok) throw Error(data.error || 'Solicitud rechazada');
    return data;
  }
  async function connect() {
    const url = new URL(value('service'));
    if (
      url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))
    )
      throw Error('Usa HTTPS o localhost');
    state.service = url.origin;
    root.LumaFlowToken = value('token') || root.LumaFlowToken;
    try {
      sessionStorage.setItem('luma-service-token', root.LumaFlowToken);
    } catch {}
    const data = await request('/api/status');
    persist();
    $('#flow-accounts').innerHTML =
      '<p>Servicio conectado · ' +
      esc(data.version) +
      '</p>' +
      (data.accounts || [])
        .map((a) => '<p>✓ ' + esc(a.name + ' · ' + a.platform) + '</p>')
        .join('') +
      '<div class="flow-actions">' +
      (data.providers || []).map((p) => b('Conectar ' + esc(p), 'oauth', p)).join('') +
      '</div>';
    $('#f-account').innerHTML = (data.accounts || [])
      .map((a) => `<option value="${esc(a.id)}">${esc(a.name + ' · ' + a.platform)}</option>`)
      .join('');
    if (data.storage)
      $('#flow-accounts').insertAdjacentHTML(
        'beforeend',
        '<p>' +
          esc(data.storage.type) +
          ' · ' +
          (data.storage.usedBytes / 1048576).toFixed(1) +
          ' / ' +
          data.storage.limitBytes / 1048576 +
          ' MB · máximo ' +
          data.storage.maxFileBytes / 1048576 +
          ' MB por archivo</p>' +
          b('Vaciar archivos temporales', 'clear-remote'),
      );
    $('#flow-post').hidden = !(data.accounts || []).length;
    status('Conexión verificada. Los permisos se conceden en cada plataforma.');
  }
  async function oauth(provider) {
    const result = await request('/api/oauth/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    window.open(result.url, '_blank', 'noopener,noreferrer');
    status('Completa la autorización oficial y vuelve a comprobar el servicio.');
  }
  let pendingPost;
  function reviewPost() {
    const date = value('date');
    pendingPost = {
      privacy: value('privacy') || 'private',
      madeForKids: value('kids') === 'yes',
      account: value('account'),
      caption: value('caption'),
      at: date ? new Date(date).toISOString() : null,
      asset: value('final'),
      key: crypto.randomUUID(),
    };
    if (!pendingPost.account || !pendingPost.asset)
      throw Error('Selecciona cuenta y archivo final');
    $('#flow-send').innerHTML =
      `<article><h4>Revisa antes de enviar</h4><p>YouTube: ${esc(pendingPost.privacy)} · TikTok: borrador que completarás en su app.</p><p>${esc(asset(pendingPost.asset).name)}</p><p>${esc(pendingPost.caption)}</p><p>${date ? esc(new Date(pendingPost.at).toLocaleString('es')) : 'Publicar ahora'}</p>${b('Confirmar envío a mi cuenta', 'send-post')}</article>`;
  }
  async function sendPost() {
    if (!pendingPost) throw Error('Revisa el envío primero');
    const a = asset(pendingPost.asset),
      upload = await request('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': a.type, 'X-Filename': encodeURIComponent(a.name) },
        body: a.blob,
      });
    const result = await request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pendingPost.key },
      body: JSON.stringify({ ...pendingPost, media: upload.id }),
    });
    pendingPost = null;
    status('Solicitud registrada: ' + result.id + ' · ' + result.status);
  }
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-flow]');
    if (!el) return;
    const action = el.dataset.flow,
      immediate = ['cancel', 'stop', 'prompter'].includes(action);
    if ((busy || recorder) && !immediate) return;
    const handler = actions[action];
    if (!handler) return;
    if (!immediate) {
      busy = true;
      abort = new AbortController();
      modal?.classList.add('busy');
    }
    try {
      await handler(el.dataset.value);
    } catch (err) {
      status(err.message);
    } finally {
      if (!immediate) {
        busy = false;
        modal?.classList.remove('busy');
      }
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.flowSelect !== undefined) {
      el.checked ? selected.add(el.dataset.flowSelect) : selected.delete(el.dataset.flowSelect);
    }
    if (el.dataset.trackVolume) {
      const t = p()?.audioTracks?.find((t) => t.id === el.dataset.trackVolume);
      if (t) {
        t.volume = Math.max(0, Math.min(2, +el.value));
        save();
      }
    }
    if (el.dataset.wordEdit !== undefined) {
      const words = p().transcript.slice(+el.dataset.wordEdit, +el.dataset.wordEdit + 5),
        text = el.value.trim().split(/\s+/);
      if (text.length !== words.length) {
        el.value = words.map((w) => w.text).join(' ');
        status(
          'Corrige conservando el número de palabras para mantener sus tiempos. Para cortar, desmarca la frase.',
        );
      } else {
        words.forEach((w, i) => (w.text = text[i]));
        save();
      }
    }
  });
  for (const id of Object.keys(tabNames))
    actions['open-' + id] = () => {
      busy = false;
      open(id);
    };
  function mount() {
    if (!$('#flow-nav')) {
      const el = document.createElement('button');
      el.id = 'flow-nav';
      el.textContent = '✦ Crear mi contenido';
      el.onclick = () => open();
      $('nav').prepend(el);
    }
    if (view === 'home' && !$('#flow-entry')) {
      const el = document.createElement('section');
      el.id = 'flow-entry';
      el.className = 'flow-entry';
      el.innerHTML =
        '<div><small>UN FLUJO, DE PRINCIPIO A FIN</small><h2>Tu grabación puede ser mucho más.</h2><p>Montaje editable, subtítulos, portadas y versiones.</p></div>' +
        b('Crear mi contenido ↗', 'open-create');
      $('.hero')?.after(el);
    }
    if (view === 'editor' && p() && !$('#flow-bar')) {
      const el = document.createElement('div');
      el.id = 'flow-bar';
      el.className = 'flow-actions';
      el.innerHTML =
        b('＋ Importar', 'open-create') +
        b('◫ Montar', 'open-tracks') +
        b('✦ Mejorar', 'open-audio') +
        b('↗ Publicar', 'open-publish') +
        b('⏺ Grabar', 'open-record') +
        b('T Voz y texto', 'open-text') +
        b('▧ Portadas', 'open-design') +
        b('◷ Versiones', 'open-review');
      $('.creator-workspace')?.before(el);
      bindHandles();
      M.prepareScene(p())
        .then(() => draw())
        .catch((e) => toast(e.message));
    }
  }
  const renderBase = render;
  render = function () {
    renderBase();
    mount();
  };
  const editorBase = renderEditor;
  renderEditor = function () {
    editorBase();
    mount();
  };
  const drawBase = draw;
  draw = function () {
    if (p())
      M.sync(
        p(),
        previewMedia
          ? Math.max(0, (previewMedia.currentTime - p().start) / (p().speed || 1))
          : previewSeconds,
        !!singlePreviewRAF,
      );
    drawBase();
  };
  const normalizeBase = C.normalize;
  C.normalize = function (v) {
    const x = normalizeBase(v);
    x.audioTracks = (Array.isArray(v.audioTracks) ? v.audioTracks : []).slice(0, 12).map((t) => ({
      id: crypto.randomUUID(),
      asset: String(t.asset || ''),
      at: Math.max(0, Math.min(120, +t.at || 0)),
      end: Math.max(0, Math.min(120, +t.end || 0)),
      sourceStart: Math.max(0, +t.sourceStart || 0),
      speed: Math.max(0.25, Math.min(3, +t.speed || 1)),
      volume: Math.max(0, Math.min(2, t.volume ?? 1)),
    }));
    x.transcript = F.normalizeWords(v.transcript);
    x.transcriptAsset = typeof v.transcriptAsset === 'string' ? v.transcriptAsset : null;
    x.flowNotes = (Array.isArray(v.flowNotes) ? v.flowNotes : []).slice(-200).map((n) => ({
      id: crypto.randomUUID(),
      text: String(n.text || '').slice(0, 1000),
      time: Math.max(0, Math.min(120, +n.time || 0)),
      done: !!n.done,
    }));
    x.flowVersions = (Array.isArray(v.flowVersions) ? v.flowVersions : []).slice(-8).map((ver) => ({
      id: crypto.randomUUID(),
      name: String(ver.name || 'Versión').slice(0, 80),
      at: +ver.at || Date.now(),
      data: C.normalize({ ...(ver.data || {}), flowVersions: [] }),
    }));
    return x;
  };
  const refsBase = P.references;
  P.references = (x) => [
    ...new Set(
      [
        ...refsBase(x),
        x.transcriptAsset,
        ...(x.flowVersions || []).flatMap((v) => [...refsBase(v.data), v.data.transcriptAsset]),
      ].filter(Boolean),
    ),
  ];
  const remapBase = P.remap;
  P.remap = function (x, ids) {
    remapBase(x, ids);
    x.transcriptAsset = ids.get(x.transcriptAsset) || null;
    for (const v of x.flowVersions || []) {
      remapBase(v.data, ids);
      v.data.transcriptAsset = ids.get(v.data.transcriptAsset) || null;
    }
  };
  const backupBase = makeBackup;
  makeBackup = async (list) => {
    const result = await backupBase(list);
    result.creator.flow = { recipes: state.recipes };
    return result;
  };
  const restoreBase = restoreCreatorBackup;
  restoreCreatorBackup = function (b, list, ids) {
    restoreBase(b, list, ids);
    for (const r of (b.creator?.flow?.recipes || []).slice(0, 30)) {
      const s = P.scene(r);
      state.recipes.push({
        id: crypto.randomUUID(),
        name: String(r.name || 'Receta').slice(0, 60),
        ...Object.fromEntries(recipeKeys.map((k) => [k, s[k]])),
      });
    }
    persist();
  };
  function drawHandles(c) {
    const box = hitBoxes.find((b) => b.id === selectedLayer);
    if (!box) return;
    const ctx = c.getContext('2d'),
      r = c.width / 90;
    ctx.save();
    ctx.fillStyle = '#7658df';
    for (const [x, y] of [
      [box.x + box.w, box.y + box.h],
      [box.x + box.w / 2, box.y - r * 3],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function bindHandles() {
    const c = $('#canvas');
    if (!c) return;
    const down = c.onpointerdown,
      move = c.onpointermove,
      up = c.onpointerup;
    let drag;
    c.onpointerdown = (e) => {
      const r = c.getBoundingClientRect(),
        x = ((e.clientX - r.left) / r.width) * c.width,
        y = ((e.clientY - r.top) / r.height) * c.height,
        box = hitBoxes.find((b) => b.id === selectedLayer),
        layer = p().layers.find((l) => l.id === selectedLayer);
      if (box && layer && !layer.locked) {
        const size = Math.hypot(x - box.x - box.w, y - box.y - box.h) < c.width / 35,
          rotate = Math.hypot(x - box.x - box.w / 2, y - box.y + c.width / 30) < c.width / 35;
        if (size || rotate) {
          drag = {
            kind: size ? 'size' : 'rotate',
            layer,
            x: e.clientX,
            y: e.clientY,
            width: layer.width,
            height: layer.height,
            size: layer.size,
            cx: r.left + ((box.x + box.w / 2) / c.width) * r.width,
            cy: r.top + ((box.y + box.h / 2) / c.height) * r.height,
          };
          c.setPointerCapture(e.pointerId);
          return;
        }
      }
      if (e.shiftKey) {
        const b = [...hitBoxes]
          .reverse()
          .find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        if (b && b.id !== 'base') {
          selected.has(b.id) ? selected.delete(b.id) : selected.add(b.id);
          selectLayer(b.id);
          return;
        }
      }
      down?.(e);
      if (canvasDrag) {
        const l = p().layers.find((l) => l.id === canvasDrag.id),
          ids = l?.group
            ? p()
                .layers.filter((q) => q.group === l.group)
                .map((q) => q.id)
            : selected.has(l?.id)
              ? [...selected]
              : [];
        drag = {
          kind: 'move',
          members: p()
            .layers.filter((l) => ids.includes(l.id) && !l.locked)
            .map((l) => ({ id: l.id, x: l.x, y: l.y })),
          x: e.clientX,
          y: e.clientY,
        };
      }
    };
    c.onpointermove = (e) => {
      if (!drag) return move?.(e);
      const r = c.getBoundingClientRect();
      if (drag.kind === 'size') {
        drag.layer.width = Math.max(
          5,
          Math.min(100, drag.width + ((e.clientX - drag.x) / r.width) * 100),
        );
        drag.layer.height = Math.max(
          2,
          Math.min(100, drag.height + ((e.clientY - drag.y) / r.height) * 100),
        );
        drag.layer.size = Math.max(16, Math.min(220, (drag.size * drag.layer.width) / drag.width));
        draw();
      } else if (drag.kind === 'rotate') {
        drag.layer.rotation = Math.max(
          -180,
          Math.min(
            180,
            (Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) * 180) / Math.PI + 90,
          ),
        );
        draw();
      } else if (drag.members.length) {
        for (const m of drag.members) {
          const l = p().layers.find((l) => l.id === m.id);
          l.x = Math.max(0, Math.min(100, m.x + ((e.clientX - drag.x) / r.width) * 100));
          l.y = Math.max(0, Math.min(100, m.y + ((e.clientY - drag.y) / r.height) * 100));
        }
        draw();
      } else move?.(e);
    };
    c.onpointerup = (e) => {
      if (drag) {
        drag = null;
        canvasDrag = null;
        sync();
        renderLayerInspector();
      } else up?.(e);
    };
    c.onpointercancel = c.onpointerup;
  }
  root.LumaFlow = { open, close, mount, drawHandles, remoteRender };
  async function remoteRender(payload) {
    await ready;
    const ids = new Map();
    for (const m of payload.media) {
      const res = await fetch('/api/media/' + encodeURIComponent(m.remote));
      if (!res.ok) throw Error('Medio remoto ausente');
      const stored = await storeAsset(await res.blob(), m.name || 'Recurso');
      ids.set(m.local, stored.id);
    }
    const x = C.normalize(payload.project);
    P.remap(x, ids);
    x.id = crypto.randomUUID();
    projects.push(x);
    current = x.id;
    go('editor');
    const out = await exportVideo({ download: false, throwErrors: true });
    if (!out) throw Error('No se pudo exportar');
    if (payload.uploadResult) {
      const uploaded = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': out.blob.type, 'X-Filename': encodeURIComponent(out.name) },
        body: out.blob,
      });
      if (!uploaded.ok) throw Error('El archivo supera el límite del servicio o no pudo guardarse');
      const data = await uploaded.json();
      return { output: data.id, name: out.name, type: out.blob.type };
    }
    const encoded = await dataURL(out.blob);
    return { base64: encoded.split(',')[1], type: out.blob.type, name: out.name };
  }
  ready.then(mount);
})(globalThis);
