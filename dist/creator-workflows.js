/* Creator templates and publication preparation; no remote account actions are simulated. */
const socialPresets = [
  {
    id: 'tiktok',
    label: 'TikTok · video',
    platform: 'TikTok',
    format: '9:16',
    mode: 'video',
    url: 'https://www.tiktok.com/',
  },
  {
    id: 'reels',
    label: 'Instagram · Reel',
    platform: 'Instagram',
    format: '9:16',
    mode: 'video',
    url: 'https://www.instagram.com/',
  },
  {
    id: 'shorts',
    label: 'YouTube · Short',
    platform: 'YouTube',
    format: '9:16',
    mode: 'video',
    url: 'https://studio.youtube.com/',
  },
  {
    id: 'carousel',
    label: 'Instagram · carrusel',
    platform: 'Instagram',
    format: '4:5',
    mode: 'carousel',
    url: 'https://www.instagram.com/',
  },
  {
    id: 'facebook',
    label: 'Facebook · imagen',
    platform: 'Facebook',
    format: '1:1',
    mode: 'image',
    url: 'https://www.facebook.com/',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn · imagen',
    platform: 'LinkedIn',
    format: '1:1',
    mode: 'image',
    url: 'https://www.linkedin.com/',
  },
];
const socialTemplates = [
  {
    id: 'hook',
    name: 'El Reel que explica',
    tag: 'Gancho → valor → acción',
    format: '9:16',
    colors: ['#29223e', '#6655ad', '#d7bb9f'],
    titles: [
      'Esto cambia la forma\nde crear contenido.',
      'Una idea clara.\nUn paso a la vez.',
      'Guárdalo para\ntu próxima creación.',
    ],
  },
  {
    id: 'tips',
    name: 'Carrusel de consejos',
    tag: '4 diapositivas · educativo',
    format: '4:5',
    colors: ['#e8dfce', '#d9e0cf', '#d7e0df', '#e1d7e9'],
    titles: [
      '3 ideas para crear\ncon intención.',
      '01\nEmpieza por una\nsola pregunta.',
      '02\nMuestra el proceso.\nNo solo el resultado.',
      '03\nHazlo útil.\nHazlo tuyo.',
    ],
  },
  {
    id: 'product',
    name: 'Tu próximo lanzamiento',
    tag: 'Producto · beneficio · CTA',
    format: '9:16',
    colors: ['#2d3737', '#9da999', '#e8d6c0'],
    titles: ['Algo nuevo\nestá por llegar.', 'Diseñado para\ntu día a día.', 'Descúbrelo hoy.'],
  },
  {
    id: 'before',
    name: 'Antes y después',
    tag: '2 escenas · transformación',
    format: '9:16',
    colors: ['#4c4858', '#a8b6a1'],
    titles: ['ANTES\nAquí empezó todo.', 'DESPUÉS\nMira lo que cambió.'],
  },
  {
    id: 'story',
    name: 'Story con intención',
    tag: 'Historia · llamada a la acción',
    format: '9:16',
    colors: ['#334956', '#d7bfa7'],
    titles: ['Una idea que\nvale compartir.', 'Hablemos.\nTe leo en comentarios.'],
  },
  {
    id: 'quote',
    name: 'Una frase, tu voz',
    tag: 'Post editorial · cuadrado',
    format: '1:1',
    colors: ['#e7dfd1'],
    titles: ['La constancia\ntambién es\ncreatividad.'],
  },
  {
    id: 'youtube',
    name: 'Portada que cuenta',
    tag: 'Miniatura · horizontal',
    format: '16:9',
    colors: ['#303e56'],
    titles: ['TU PRÓXIMA\nGRAN IDEA'],
  },
  {
    id: 'launch',
    name: 'Aviso para tu comunidad',
    tag: 'Anuncio · 2 escenas',
    format: '4:5',
    colors: ['#634d80', '#ecd8b5'],
    titles: ['TENEMOS\nNOVEDADES.', 'Lo mejor de crear\nes compartirlo.'],
  },
];
function renderTemplates() {
  $('main').innerHTML =
    intro(
      'Una buena base. Tu propia voz.',
      'Plantillas pensadas para contenido social: cambia las palabras, arrastra tus clips y añade tu marca.',
    ) +
    '<div class="actions"><button onclick="brandDialog()">✦ Mi kit de marca</button><button onclick="newProject()">＋ Lienzo en blanco</button></div><div class="template-gallery">' +
    socialTemplates
      .map(
        (t, i) =>
          '<button class="template-tile" onclick="createFromTemplate(\'' +
          t.id +
          '\')"><div class="template-preview" style="background:' +
          t.colors[0] +
          ';color:' +
          (t.colors[0].startsWith('#e') ? '#3d3a40' : '#ffffff') +
          '"><small>LUMA · ' +
          t.format +
          '</small><strong>' +
          esc(t.titles[0]).replace(/\n/g, '<br>') +
          '</strong><span>' +
          t.titles.length +
          ' escena' +
          (t.titles.length > 1 ? 's' : '') +
          ' ↗</span></div><div><h3>' +
          t.name +
          '</h3><p>' +
          t.tag +
          '</p></div></button>',
      )
      .join('') +
    '</div><div class="notice">Las plantillas usan texto y gráficos originales de Luma. Añade tus fotos o videos desde la biblioteca; no contienen imágenes de muestra que debas reemplazar a ciegas.</div>';
}
function createFromTemplate(id) {
  const t = socialTemplates.find((t) => t.id === id),
    b = brand();
  if (!t) return;
  const x = C.normalize({
    name: t.name,
    format: t.format,
    platform: t.id === 'youtube' ? 'YouTube' : 'Instagram',
    text: '',
    bg: t.colors[0],
    color: '#ffffff',
    duration: 4,
    volume: 1,
    musicVolume: 0.3,
    caption: b.cta + '\n\n' + b.hashtags,
  });
  x.scenes = t.titles.map((text, i) =>
    P.scene({
      name: ['Gancho', 'Desarrollo', 'Cierre', 'Extra'][i] || 'Escena ' + (i + 1),
      text,
      bg: t.colors[i % t.colors.length],
      color: ['tips', 'quote'].includes(t.id) ? '#35373b' : '#ffffff',
      fontSize: t.id === 'youtube' ? 98 : 82,
      duration: 4,
      textY: 48,
      transition: i ? 'fade' : 'cut',
      layers: [
        P.layer({
          kind: 'text',
          text: b.name,
          x: 50,
          y: 88,
          size: 28,
          opacity: 0.8,
          color: ['tips', 'quote'].includes(t.id) ? '#5c635d' : '#ffffff',
          animation: 'fade',
        }),
        P.layer({ kind: 'shape', x: 50, y: 20, width: 12, height: 1, fill: b.secondary }),
      ],
    }),
  );
  x.activeScene = x.scenes[0].id;
  P.activate(x, x.activeScene, false);
  projects.unshift(x);
  current = x.id;
  history = [];
  future = [];
  selectedLayer = 'base';
  save();
  go('editor');
  toast('Plantilla lista. Arrastra tus medios para personalizarla.');
}
function readPublishQueue() {
  try {
    const q = JSON.parse(localStorage.getItem('luma-queue') || '[]');
    return Array.isArray(q)
      ? q
          .filter(
            (j) =>
              j &&
              typeof j.id === 'string' &&
              typeof j.projectId === 'string' &&
              socialPresets.some((s) => s.id === j.target),
          )
          .slice(0, 300)
      : [];
  } catch {
    return [];
  }
}
let publishQueue = readPublishQueue();
function saveQueue() {
  try {
    localStorage.setItem('luma-queue', JSON.stringify(publishQueue));
  } catch {
    toast('No hay espacio para guardar la cola. Descarga el plan CSV.');
  }
}
function queueCurrent() {
  if (!p()) return toast('Abre un proyecto primero.');
  P.mirror(p());
  go('publish');
}
function renderPublish() {
  const source = p() || projects[0],
    b = brand();
  $('main').innerHTML =
    intro(
      'Del montaje a tus redes. Más rápido.',
      'Prepara versiones, descripciones y archivos en lote. Conserva el control de cada publicación.',
    ) +
    '<div class="publish-layout"><section class="panel publish-builder"><h3>1 · Elige tu contenido</h3><label for="queueProject">Proyecto de origen</label><select id="queueProject">' +
    projects
      .map(
        (x) =>
          '<option value="' +
          x.id +
          '" ' +
          (source?.id === x.id ? 'selected' : '') +
          '>' +
          esc(x.name) +
          '</option>',
      )
      .join('') +
    '</select><h3>2 · Crea versiones por red</h3><div class="target-grid">' +
    socialPresets
      .map(
        (s, i) =>
          '<label><input type="checkbox" name="queueTarget" value="' +
          s.id +
          '" ' +
          (i < 3 ? 'checked' : '') +
          '> <span><b>' +
          s.label +
          '</b><small>' +
          s.format +
          ' · ' +
          (s.mode === 'carousel'
            ? 'todas las escenas PNG'
            : s.mode === 'image'
              ? 'primera escena PNG'
              : 'montaje completo') +
          '</small></span></label>',
      )
      .join('') +
    '</div><label for="captionTemplate">Plantilla de descripción</label><textarea id="captionTemplate">{titulo}\n\n{cta}\n\n{hashtags}</textarea><p class="hint">Variables: {titulo}, {marca}, {cta}, {hashtags}. Se rellenan con tu proyecto y tu kit de marca.</p><label for="queueDate">Fecha planificada (opcional)</label><input id="queueDate" type="datetime-local"><div class="actions"><button class="primary" onclick="createQueueJobs()">＋ Crear versiones y tareas</button><button onclick="brandDialog()">✦ Kit de marca</button></div><div class="notice">Luma prepara archivos y textos en lote. El envío directo a redes necesita conectar tus cuentas y todavía no está disponible. Descarga el paquete o comparte los archivos para subirlos desde tu cuenta.</div></section><section class="panel"><div class="section"><div><h2>Tu cola de preparación</h2><p>' +
    publishQueue.filter((j) => j.status === 'Preparado').length +
    ' listas para subir · ' +
    publishQueue.length +
    ' tareas</p></div><button class="link" onclick="selectAllJobs()">Seleccionar todo</button></div><div class="actions"><button class="primary" onclick="prepareSelected()">⚡ Preparar seleccionadas</button><button onclick="downloadQueuePackage()">↓ Paquete ZIP</button><button onclick="downloadPlanCSV()">↓ Plan CSV</button><button onclick="queueCalendar()">↓ Calendario ICS</button></div><div id="queueRows">' +
    (publishQueue.length
      ? publishQueue.map(queueRow).join('')
      : '<div class="empty">Elige un proyecto y las redes.<br>Luma creará versiones independientes y tareas de preparación.</div>') +
    '</div></section></div>';
}
function queueRow(j) {
  const project = projects.find((x) => x.id === j.projectId),
    preset = socialPresets.find((s) => s.id === j.target);
  return (
    '<article class="queue-card"><div class="queue-top"><input type="checkbox" aria-label="Seleccionar tarea ' +
    esc(project?.name || 'Proyecto eliminado') +
    '" ' +
    (selectedQueue.has(j.id) ? 'checked' : '') +
    ' onchange="this.checked?selectedQueue.add(\'' +
    j.id +
    "'):selectedQueue.delete('" +
    j.id +
    '\')"><div><strong>' +
    esc(project?.name || 'Proyecto eliminado') +
    '</strong><small>' +
    preset.label +
    ' · ' +
    preset.format +
    '</small></div><span class="queue-state ' +
    (j.status === 'Preparado' ? 'ready' : '') +
    '">' +
    esc(j.status || 'Pendiente') +
    '</span></div>' +
    (j.error ? '<p class="queue-error">' + esc(j.error) + '</p>' : '') +
    '<details><summary>Descripción, fecha y acciones</summary><label for="qcaption-' +
    j.id +
    '">Descripción</label><textarea id="qcaption-' +
    j.id +
    '" onchange="updateJob(\'' +
    j.id +
    "','caption',this.value)\">" +
    esc(j.caption) +
    '</textarea><label for="qdate-' +
    j.id +
    '">Fecha planificada</label><input id="qdate-' +
    j.id +
    '" type="datetime-local" value="' +
    esc(j.date || '') +
    '" onchange="updateJob(\'' +
    j.id +
    '\',\'date\',this.value)"><div class="actions"><button onclick="openProject(\'' +
    j.projectId +
    '\')">Editar versión</button><button onclick="copyJobCaption(\'' +
    j.id +
    '\')">Copiar texto</button><button onclick="downloadJob(\'' +
    j.id +
    '\')">↓ Archivos</button><button onclick="shareJob(\'' +
    j.id +
    '\')">Compartir archivo</button><button onclick="window.open(\'' +
    preset.url +
    "','_blank','noopener,noreferrer')\">Abrir " +
    preset.platform +
    ' ↗</button><button onclick="markJobPublished(\'' +
    j.id +
    '\')">Marcar subida manual</button><button class="danger" onclick="removeJob(\'' +
    j.id +
    '\')">Quitar tarea</button></div></details></article>'
  );
}
function createQueueJobs() {
  const source = projects.find((x) => x.id === $('#queueProject').value);
  if (!source) return toast('Crea un proyecto primero.');
  const targets = [...document.querySelectorAll('[name="queueTarget"]:checked')].map(
    (el) => el.value,
  );
  if (!targets.length) return toast('Selecciona al menos una red.');
  if (publishQueue.length + targets.length > 300) return toast('Máximo 300 tareas en la cola.');
  P.ensure(source);
  P.mirror(source);
  const template = $('#captionTemplate').value,
    b = brand();
  for (const target of targets) {
    const preset = socialPresets.find((s) => s.id === target),
      x = structuredClone(source);
    x.id = crypto.randomUUID();
    x.name = source.name + ' · ' + preset.label;
    x.format = preset.format;
    x.platform = preset.platform;
    x.created = Date.now();
    x.status = 'Borrador';
    x.scenes = x.scenes.map(P.scene);
    x.activeScene = x.scenes[0].id;
    P.activate(x, x.activeScene, false);
    const caption = P.caption(template, {
      titulo: source.name,
      marca: b.name,
      cta: b.cta,
      hashtags: b.hashtags,
    });
    x.caption = caption;
    x.date = $('#queueDate').value;
    projects.unshift(x);
    const j = {
      id: crypto.randomUUID(),
      projectId: x.id,
      target,
      caption,
      date: x.date,
      status: 'Pendiente',
      files: [],
    };
    publishQueue.unshift(j);
    selectedQueue.add(j.id);
  }
  save();
  saveQueue();
  renderPublish();
  toast(targets.length + ' versiones creadas sin cambiar el proyecto de origen.');
}
function updateJob(id, key, value) {
  const j = publishQueue.find((j) => j.id === id);
  if (!j) return;
  if (key === 'caption') j.caption = value.slice(0, 10000);
  if (key === 'date') j.date = value;
  const x = projects.find((x) => x.id === j.projectId);
  if (x) {
    x.caption = j.caption;
    x.date = j.date;
    save();
  }
  saveQueue();
}
function selectAllJobs() {
  publishQueue.forEach((j) => selectedQueue.add(j.id));
  renderPublish();
}
function removeJob(id) {
  publishQueue = publishQueue.filter((j) => j.id !== id);
  selectedQueue.delete(id);
  saveQueue();
  renderPublish();
}
function markJobPublished(id) {
  const j = publishQueue.find((j) => j.id === id);
  if (j) {
    j.status = 'Subida manual confirmada';
    j.publishedAt = new Date().toISOString();
    saveQueue();
    renderPublish();
  }
}
async function copyJobCaption(id) {
  try {
    await navigator.clipboard.writeText(publishQueue.find((j) => j.id === id).caption);
    toast('Descripción copiada');
  } catch {
    toast('Abre la descripción para copiarla manualmente.');
  }
}
async function prepareSelected() {
  if (batchBusy || rendering) return;
  const jobs = publishQueue.filter((j) => selectedQueue.has(j.id));
  if (!jobs.length) return toast('Selecciona las tareas que quieras preparar.');
  batchBusy = true;
  batchCancel = false;
  let done = 0;
  const banner = document.createElement('div');
  banner.className = 'batch-banner';
  banner.innerHTML =
    '<strong></strong><button onclick="batchCancel=true;abortExport=true">Cancelar lote</button>';
  document.body.append(banner);
  try {
    for (const j of jobs) {
      if (batchCancel) break;
      const x = projects.find((x) => x.id === j.projectId);
      if (!x) {
        j.status = 'Revisar';
        j.error = 'El proyecto ya no existe.';
        continue;
      }
      const preset = socialPresets.find((s) => s.id === j.target);
      banner.querySelector('strong').textContent =
        'Preparando ' + (done + 1) + '/' + jobs.length + ' · ' + preset.label;
      j.status = 'Preparando';
      j.error = '';
      saveQueue();
      try {
        batchInternal = true;
        current = x.id;
        go('editor');
        batchInternal = false;
        let files;
        if (preset.mode === 'video') {
          const result = await exportVideo({ download: false, throwErrors: true });
          if (!result) throw Error('Exportación cancelada');
          files = [{ name: result.name, blob: result.blob }];
        } else {
          const copy = structuredClone(x);
          if (preset.mode === 'image') copy.scenes = copy.scenes.slice(0, 1);
          files = await carouselFiles(copy);
        }
        const saved = [];
        for (const f of files) {
          const a = await storeAsset(f.blob, f.name);
          saved.push({ id: a.id, name: f.name });
        }
        j.files = saved;
        j.status = 'Preparado';
        j.preparedAt = new Date().toISOString();
        j.preparedFingerprint = projectFingerprint(x);
        done++;
      } catch (e) {
        j.status = 'Revisar';
        j.error = e.message;
        if (abortExport) batchCancel = true;
      }
      saveQueue();
    }
  } finally {
    batchBusy = false;
    batchInternal = false;
    banner.remove();
    go('publish');
    toast(done + ' tareas preparadas' + (batchCancel ? ' · lote detenido.' : '.'));
  }
}
function jobFiles(j) {
  return (j.files || [])
    .map((f) => {
      const a = assets.find((a) => a.id === f.id);
      return a ? { name: f.name, blob: a.blob } : null;
    })
    .filter(Boolean);
}
async function downloadJob(id) {
  try {
    const j = publishQueue.find((j) => j.id === id),
      files = jobFiles(j);
    if (!files.length) throw Error('Prepara la tarea primero.');
    files.push({
      name: 'descripcion.txt',
      blob: new Blob([j.caption], { type: 'text/plain;charset=utf-8' }),
    });
    download(await P.zip(files), 'Luma-' + j.target + '-' + id.slice(0, 8) + '.zip');
  } catch (e) {
    toast(e.message);
  }
}
async function shareJob(id) {
  const j = publishQueue.find((j) => j.id === id),
    files = jobFiles(j).map((f) => new File([f.blob], f.name, { type: f.blob.type }));
  if (!files.length) return toast('Prepara esta tarea primero.');
  try {
    if (navigator.canShare?.({ files }))
      await navigator.share({
        files,
        title: projects.find((x) => x.id === j.projectId)?.name,
        text: j.caption,
      });
    else
      toast('Tu navegador no comparte archivos directamente. Descarga los archivos y abre la red.');
  } catch (e) {
    if (e.name !== 'AbortError') toast(e.message);
  }
}
function selectedJobs() {
  const jobs = publishQueue.filter((j) => selectedQueue.has(j.id));
  return jobs.length ? jobs : publishQueue;
}
async function downloadQueuePackage() {
  try {
    const jobs = selectedJobs(),
      files = [];
    let i = 0;
    for (const j of jobs) {
      const ready = jobFiles(j);
      if (!ready.length) continue;
      const folder = String(++i).padStart(2, '0') + '-' + j.target + '/';
      for (const f of ready) files.push({ name: folder + f.name, blob: f.blob });
      files.push({ name: folder + 'descripcion.txt', blob: new Blob([j.caption]) });
    }
    if (!i) return toast('Prepara alguna tarea antes de crear el paquete.');
    files.push({ name: 'plan.csv', blob: new Blob([planCSV(jobs)], { type: 'text/csv' }) });
    files.push({
      name: 'LEEME.txt',
      blob: new Blob([
        'Archivos finales preparados en Luma Studio. Revisa cada pieza y súbela desde la cuenta de su red. Este paquete no publica automáticamente.',
      ]),
    });
    const archive = await P.zip(files);
    if (window.packageURL) URL.revokeObjectURL(window.packageURL);
    window.packageURL = URL.createObjectURL(archive);
    let result = document.getElementById('packageResult');
    if (!result) {
      result = document.createElement('div');
      result.id = 'packageResult';
      result.className = 'notice';
      document.getElementById('queueRows').before(result);
    }
    result.innerHTML =
      '<strong>Paquete listo · ' +
      i +
      ' tareas</strong><br><a href="' +
      window.packageURL +
      '" download="Luma-publicaciones.zip">Descargar paquete listo</a>';
    download(archive, 'Luma-publicaciones.zip');
  } catch (e) {
    toast(e.message);
  }
}
function planCSV(jobs) {
  return P.csv([
    ['Red', 'Proyecto', 'Fecha planificada', 'Estado de preparación', 'Descripción'],
    ...jobs.map((j) => [
      socialPresets.find((s) => s.id === j.target).label,
      projects.find((x) => x.id === j.projectId)?.name || '',
      j.date,
      j.status,
      j.caption,
    ]),
  ]);
}
function downloadPlanCSV() {
  download(
    new Blob(['\uFEFF' + planCSV(selectedJobs())], { type: 'text/csv;charset=utf-8' }),
    'Luma-plan.csv',
  );
}
function queueCalendar() {
  const jobs = selectedJobs().filter((j) => j.date);
  if (!jobs.length) return toast('Añade fechas a las tareas primero.');
  const clean = (s) =>
      String(s)
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;'),
    stamp = (d) =>
      d
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
  const now = stamp(new Date()),
    events = [];
  for (const j of jobs) {
    const dt = new Date(j.date);
    if (!Number.isFinite(dt.getTime())) continue;
    events.push(
      [
        'BEGIN:VEVENT',
        'UID:' + j.id + '@luma.local',
        'DTSTAMP:' + now,
        'DTSTART:' + stamp(dt),
        'DTEND:' + stamp(new Date(dt.getTime() + 15 * 60000)),
        'SUMMARY:' +
          clean(
            socialPresets.find((s) => s.id === j.target).label +
              ' · ' +
              (projects.find((x) => x.id === j.projectId)?.name || 'Contenido'),
          ),
        'DESCRIPTION:' + clean(j.caption + '\nPreparar y subir manualmente desde tu cuenta.'),
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Preparar publicación',
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n'),
    );
  }
  download(
    new Blob(
      [
        [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Luma Studio//ES',
          ...events,
          'END:VCALENDAR',
        ].join('\r\n'),
      ],
      { type: 'text/calendar' },
    ),
    'Luma-publicaciones.ics',
  );
}
go('home');

function projectFingerprint(x) {
  const value = JSON.stringify({
    format: x.format,
    scenes: x.scenes,
    audio: x.audio,
    audioTracks: x.audioTracks,
    volume: x.volume,
    musicVolume: x.musicVolume,
    musicLoop: x.musicLoop,
    ducking: x.ducking,
  });
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16) + ':' + value.length;
}
const saveCreatorBase = save;
save = function () {
  saveCreatorBase();
  if (typeof publishQueue === 'undefined') return;
  let dirty = false;
  for (const j of publishQueue) {
    if (j.status !== 'Preparado' || !j.preparedFingerprint) continue;
    const x = projects.find((x) => x.id === j.projectId);
    if (x && projectFingerprint(x) !== j.preparedFingerprint) {
      j.status = 'Cambios sin preparar';
      dirty = true;
    }
  }
  if (dirty) saveQueue();
};
const makeCreatorBackupBase = makeBackup;
makeBackup = async function (list) {
  const backup = await makeCreatorBackupBase(list),
    ids = new Set(list.map((x) => x.id)),
    queue = publishQueue.filter((j) => ids.has(j.projectId)),
    included = new Set(backup.media.map((m) => m.id));
  for (const j of queue)
    for (const file of j.files || []) {
      if (included.has(file.id)) continue;
      const a = assets.find((a) => a.id === file.id);
      if (a) {
        backup.media.push({ id: a.id, name: a.name, type: a.type, data: await dataURL(a.blob) });
        included.add(a.id);
      }
    }
  if (backup.media.reduce((n, a) => n + a.data.length, 0) > 240 * 1024 * 1024)
    throw Error('El respaldo supera el límite de memoria. Exporta proyectos por separado.');
  backup.creator = { version: 1, brand: brand(), queue };
  return backup;
};
function restoreCreatorBackup(backup, restored, mediaIds) {
  if (!backup.creator || backup.creator.version !== 1) return;
  const mapping = new Map(backup.projects.map((x, i) => [x.id, restored[i]?.id]));
  const incoming = Array.isArray(backup.creator.queue) ? backup.creator.queue.slice(0, 300) : [];
  for (const j of incoming) {
    const projectId = mapping.get(j.projectId);
    if (!projectId || !socialPresets.some((s) => s.id === j.target)) continue;
    const files = (Array.isArray(j.files) ? j.files : [])
        .slice(0, 24)
        .filter((f) => f && mediaIds.has(f.id))
        .map((f) => ({
          id: mediaIds.get(f.id),
          name: String(f.name || 'contenido').slice(0, 180),
        })),
      x = restored.find((x) => x.id === projectId);
    publishQueue.push({
      id: crypto.randomUUID(),
      projectId,
      target: j.target,
      caption: String(j.caption || '').slice(0, 10000),
      date: /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(j.date) ? j.date : '',
      status: files.length ? 'Preparado' : 'Pendiente',
      files,
      preparedFingerprint: files.length ? projectFingerprint(x) : null,
    });
  }
  publishQueue = publishQueue.slice(-300);
  saveQueue();
  const b = backup.creator.brand;
  if (b && !localStorage.getItem('luma-brand'))
    localStorage.setItem(
      'luma-brand',
      JSON.stringify({
        name: String(b.name || 'Mi marca').slice(0, 100),
        primary: /^#[a-f0-9]{6}$/i.test(b.primary) ? b.primary : '#7658df',
        secondary: /^#[a-f0-9]{6}$/i.test(b.secondary) ? b.secondary : '#f0c6a8',
        cta: String(b.cta || '').slice(0, 500),
        hashtags: String(b.hashtags || '').slice(0, 1000),
      }),
    );
}
