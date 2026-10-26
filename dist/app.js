const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
const views = [
  ['home', '▦', 'Vista general'],
  ['projects', '▱', 'Mis proyectos'],
  ['editor', '◫', 'Editor de contenido'],
  ['library', '▧', 'Biblioteca multimedia'],
  ['calendar', '▦', 'Calendario'],
  ['ideas', '✧', 'Ideas y guiones'],
];
function readProjects() {
  try {
    const data = JSON.parse(localStorage.getItem('luma-projects') || '[]');
    return Array.isArray(data)
      ? data.filter((x) => x && typeof x.name === 'string' && typeof x.id === 'string')
      : [];
  } catch {
    return [];
  }
}
let projects = readProjects(),
  current = null,
  view = 'home',
  assets = [],
  db,
  filter = 'Todos',
  query = '',
  imageObj = null;
const ready = new Promise((resolve, reject) => {
  const r = indexedDB.open('luma-media', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' });
  r.onsuccess = () => {
    db = r.result;
    const q = db.transaction('files').objectStore('files').getAll();
    q.onsuccess = () => {
      assets = q.result.map((a) => ({ ...a, url: URL.createObjectURL(a.blob) }));
      resolve();
    };
    q.onerror = reject;
  };
  r.onerror = reject;
});
function toast(s) {
  $('#toast').textContent = s;
  $('#toast').classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3000);
}
function save() {
  try {
    localStorage.setItem('luma-projects', JSON.stringify(projects));
  } catch {
    toast('No hay espacio para guardar. Exporta tu proyecto.');
  }
}
function p() {
  return projects.find((x) => x.id === current);
}
function intro(title, sub) {
  return (
    '<div class="intro"><div><div class="eyebrow">TU ESPACIO CREATIVO</div><h1>' +
    title +
    '</h1><p>' +
    sub +
    '</p></div><span class="date">' +
    new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) +
    '</span></div>'
  );
}
function go(v) {
  view = v;
  document
    .querySelectorAll('nav button')
    .forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  $('#breadcrumb').textContent = views.find((x) => x[0] === v)[2];
  render();
}
$('nav').innerHTML = views
  .map(
    ([id, icon, title]) =>
      '<button data-view="' +
      id +
      '" onclick="go(\'' +
      id +
      '\')">' +
      icon +
      ' &nbsp; ' +
      title +
      '</button>',
  )
  .join('');
function newProject(format = '9:16') {
  $('#format').value = format;
  $('#name').value = '';
  $('dialog').showModal();
  $('#name').focus();
}
$('#create').onsubmit = (e) => {
  e.preventDefault();
  const x = {
    id: crypto.randomUUID(),
    name: $('#name').value.trim(),
    format: $('#format').value,
    platform: $('#platform').value,
    text: 'Tu próxima\ngran historia.',
    bg: '#c6cbb9',
    color: '#ffffff',
    fontSize: 72,
    brightness: 100,
    saturation: 100,
    asset: null,
    caption: '',
    date: '',
    status: 'Borrador',
    created: Date.now(),
    start: 0,
    end: 0,
    duration: 6,
    volume: 1,
    musicVolume: 0.35,
    textY: 50,
    subtitles: '',
    audio: null,
    checklist: [],
  };
  if (!x.name) return;
  projects.unshift(x);
  current = x.id;
  save();
  $('dialog').close();
  go('editor');
};
function openProject(id) {
  current = id;
  go('editor');
}
function cards(list) {
  return list.length
    ? '<div class="projects">' +
        list
          .map(
            (x, i) =>
              '<button class="project" onclick="openProject(\'' +
              x.id +
              '\')"><div class="thumb tone' +
              (i % 3) +
              '"><span class="badge">' +
              esc(x.platform) +
              '</span><span class="poster">' +
              esc(x.name.split(' ').slice(0, 2).join(' ')) +
              '</span><span class="ratio">' +
              esc(x.format) +
              '</span></div><div class="info"><strong>' +
              esc(x.name) +
              '</strong><p>' +
              esc(x.status) +
              ' · ' +
              new Date(x.created).toLocaleDateString('es') +
              ' &nbsp; ↗</p></div></button>',
          )
          .join('') +
        '</div>'
    : '<div class="empty">Tu espacio para la próxima gran idea.<br><br><button onclick="newProject()">＋ Crear mi primer proyecto</button></div>';
}
function render() {
  if (view === 'home') {
    $('main').innerHTML =
      intro(
        'Dale vida a tus ideas.',
        'Un espacio para crear, editar y preparar tu próximo gran contenido.',
      ) +
      '<section class="hero"><div class="eyebrow">DE LA IDEA A LA PUBLICACIÓN</div><h2>Tu creatividad.<br>Sin límites de formato.</h2><p>Crea para cada red. Hazlo a tu manera. Todo desde tu estudio.</p><button class="primary" onclick="newProject()">＋ Empezar a crear</button><div class="hero-art"><div class="art">CREATE</div><div class="art two">YOUR<br>STORY</div><div class="art-tag">✦ Ideas que cobran vida</div></div></section><div class="stats">' +
      [
        ['Proyectos creados', projects.length, '↗', 'Tu contenido, organizado'],
        [
          'En edición',
          projects.filter((x) => x.status === 'Borrador').length,
          '◫',
          'Ideas en construcción',
        ],
        ['Planificados', projects.filter((x) => x.date).length, '▦', 'En tu calendario local'],
        ['Archivos multimedia', assets.length, '▧', 'Listos para tu próxima idea'],
      ]
        .map(
          ([a, b, c, d]) =>
            '<div class="stat"><i>' +
            c +
            '</i><label>' +
            a +
            '</label><strong>' +
            b.toString().padStart(2, '0') +
            '</strong><small>' +
            d +
            '</small></div>',
        )
        .join('') +
      '</div><div class="section"><div><h2>¿Qué vas a crear hoy?</h2><p>Elige un formato y empieza con un lienzo a tu medida.</p></div></div><div class="formats">' +
      [
        ['9:16', '▯', 'Video vertical', 'Reels · TikTok · Shorts'],
        ['1:1', '□', 'Post cuadrado', 'Instagram · Facebook'],
        ['16:9', '▭', 'Video horizontal', 'YouTube · LinkedIn'],
        ['4:5', '▥', 'Post retrato', 'Instagram · Pinterest'],
      ]
        .map(
          ([r, i, a, b]) =>
            '<button class="format" onclick="newProject(\'' +
            r +
            '\')"><span class="icon">' +
            i +
            '</span><div><strong>' +
            a +
            '</strong><small>' +
            b +
            '</small></div></button>',
        )
        .join('') +
      '</div><div class="section"><div><h2>Proyectos recientes</h2><p>Tus ideas merecen llegar más lejos.</p></div><button class="link" onclick="go(\'projects\')">Ver todos los proyectos ↗</button></div>' +
      cards(projects.slice(0, 3)) +
      '<div class="note"><span>✧</span><div><strong>Una gran historia empieza con una pequeña idea.</strong><p>Organiza tus guiones, explora enfoques y prepara tu próxima publicación.</p></div><button class="link" onclick="go(\'ideas\')">Abrir ideas ↗</button></div>';
  }
  if (view === 'projects') {
    $('main').innerHTML =
      intro('Tus ideas, en movimiento.', 'Organiza y continúa tus proyectos de contenido.') +
      '<div class="toolbar"><input class="search" placeholder="Buscar proyectos…" value="' +
      esc(query) +
      '" oninput="query=this.value;projectResults()">' +
      ['Todos', 'Borrador', 'Listo']
        .map(
          (f) =>
            '<button class="chip ' +
            (filter === f ? 'active' : '') +
            '" onclick="filter=\'' +
            f +
            '\';render()">' +
            f +
            '</button>',
        )
        .join('') +
      '</div><div id="results"></div>';
    projectResults();
  }
  if (view === 'library') {
    $('main').innerHTML =
      intro('Tu biblioteca creativa.', 'Imágenes, videos y audio guardados en este navegador.') +
      '<div class="actions"><button class="primary" onclick="importFiles()">↥ Importar archivos</button></div><div class="assets">' +
      (assets.length
        ? assets
            .map(
              (a) =>
                '<div class="asset">' +
                (a.type.startsWith('image')
                  ? '<img src="' + a.url + '" alt="' + esc(a.name) + '">'
                  : a.type.startsWith('video')
                    ? '<video src="' + a.url + '" controls preload="metadata"></video>'
                    : '<audio src="' + a.url + '" controls></audio>') +
                '<p>' +
                esc(a.name) +
                '</p><button onclick="useAsset(\'' +
                a.id +
                '\')">Usar en editor</button> <button class="danger" onclick="removeAsset(\'' +
                a.id +
                '\')">Eliminar</button></div>',
            )
            .join('')
        : '<div class="empty">Importa tu primer archivo para empezar.</div>') +
      '</div>';
  }
  if (view === 'editor') renderEditor();
  if (view === 'calendar') renderCalendar();
  if (view === 'ideas') renderIdeas();
}
function projectResults() {
  $('#results').innerHTML = cards(
    projects.filter(
      (x) =>
        (filter === 'Todos' || x.status === filter) &&
        x.name.toLowerCase().includes(query.toLowerCase()),
    ),
  );
}
function renderEditor() {
  const x = p();
  if (!x) {
    $('main').innerHTML =
      intro('Tu próximo contenido empieza aquí.', 'Crea un proyecto o abre uno de tu biblioteca.') +
      cards(projects);
    return;
  }
  const a = assets.find((a) => a.id === x.asset);
  $('main').innerHTML =
    intro(esc(x.name), esc(x.platform) + ' · ' + esc(x.format) + ' · ' + esc(x.status)) +
    '<div class="actions"><button onclick="go(\'projects\')">← Proyectos</button><button onclick="downloadProject()">↓ Proyecto JSON</button><button class="primary" onclick="exportImage()">↓ Exportar PNG</button><button onclick="duplicate()">Duplicar</button><button class="danger" onclick="deleteProject()">Eliminar</button></div><div class="editor"><section class="panel"><h3>◫ Diseño</h3><label>Texto del lienzo</label><textarea id="overlay">' +
    esc(x.text) +
    '</textarea><label>Formato</label><select id="ratio">' +
    ['9:16', '1:1', '16:9', '4:5']
      .map((r) => '<option ' + (r === x.format ? 'selected' : '') + '>' + r + '</option>')
      .join('') +
    '</select><label>Fondo</label><input id="bg" type="color" value="' +
    x.bg +
    '"><label>Color de texto</label><input id="color" type="color" value="' +
    x.color +
    '"><label>Tamaño del texto</label><input id="fontSize" type="range" min="20" max="140" value="' +
    x.fontSize +
    '"><label>Brillo</label><input id="brightness" type="range" min="20" max="180" value="' +
    x.brightness +
    '"><label>Saturación</label><input id="saturation" type="range" min="0" max="200" value="' +
    x.saturation +
    '"><label>Archivo multimedia</label><select id="asset"><option value="">Solo fondo</option>' +
    assets
      .filter((a) => !a.type.startsWith('audio'))
      .map(
        (a) =>
          '<option value="' +
          a.id +
          '" ' +
          (x.asset === a.id ? 'selected' : '') +
          '>' +
          esc(a.name) +
          '</option>',
      )
      .join('') +
    '</select><button style="margin-top:12px;width:100%" onclick="importFiles()">＋ Importar archivo</button></section><div class="stage">' +
    (a?.type.startsWith('video')
      ? '<video id="previewVideo" src="' + a.url + '" controls playsinline></video>'
      : '<canvas id="canvas"></canvas>') +
    '</div><section class="panel"><h3>Preparar publicación</h3><label>Título</label><input id="editName" value="' +
    esc(x.name) +
    '"><label>Texto y hashtags</label><textarea id="caption" placeholder="Escribe tu descripción…">' +
    esc(x.caption) +
    '</textarea><p class="hint" id="chars">' +
    x.caption.length +
    ' caracteres</p><label>Estado</label><select id="status"><option ' +
    (x.status === 'Borrador' ? 'selected' : '') +
    '>Borrador</option><option ' +
    (x.status === 'Listo' ? 'selected' : '') +
    '>Listo</option></select><label>Fecha de planificación</label><input id="date" type="datetime-local" value="' +
    esc(x.date) +
    '"><div class="notice">La planificación organiza tu calendario. No publica automáticamente en redes.</div><button onclick="copyCaption()">Copiar descripción</button><p class="hint">Las imágenes se exportan en PNG. Los videos se reproducen y permiten marcar un fragmento; esta versión no renderiza video.</p></section></div>' +
    (a?.type.startsWith('video')
      ? '<section class="track"><strong>Selección de fragmento</strong><div class="actions"><button onclick="mark(\'start\')">Marcar inicio</button><button onclick="mark(\'end\')">Marcar final</button><button onclick="playSegment()">▶ Ver fragmento</button><button onclick="downloadOriginal()">↓ Archivo original</button></div><div class="clip" id="clip">Inicio: ' +
        x.start.toFixed(1) +
        ' s · Final: ' +
        x.end.toFixed(1) +
        ' s</div></section>'
      : '<section class="track"><strong>Capas del diseño</strong><div class="clip">▧ Fondo / imagen &nbsp; ━━━━━━━━━━━━━━━ &nbsp; T Texto superpuesto</div></section>');
  const map = {
    overlay: 'text',
    ratio: 'format',
    bg: 'bg',
    color: 'color',
    fontSize: 'fontSize',
    brightness: 'brightness',
    saturation: 'saturation',
    asset: 'asset',
    editName: 'name',
    caption: 'caption',
    status: 'status',
    date: 'date',
  };
  Object.entries(map).forEach(
    ([id, key]) =>
      ($('#' + id).oninput = (e) => {
        x[key] = ['fontSize', 'brightness', 'saturation'].includes(key)
          ? +e.target.value
          : e.target.value;
        save();
        if (id === 'asset') {
          renderEditor();
          return;
        }
        if (id === 'caption') $('#chars').textContent = x.caption.length + ' caracteres';
        if (id === 'editName') $('h1').textContent = x.name;
        if (id === 'ratio') {
          loadCanvas();
          return;
        }
        draw();
      }),
  );
  loadCanvas();
  if ($('#previewVideo')) {
    $('#previewVideo').style.filter =
      'brightness(' + x.brightness + '%) saturate(' + x.saturation + '%)';
    $('#previewVideo').ontimeupdate = () => {
      const v = $('#previewVideo');
      if (window.segmentPlaying && v.currentTime >= x.end) {
        v.pause();
        window.segmentPlaying = false;
      }
    };
  }
}
function loadCanvas() {
  imageObj = null;
  const x = p(),
    a = assets.find((a) => a.id === x.asset);
  if (a?.type.startsWith('image')) {
    const i = new Image();
    i.onload = () => {
      imageObj = i;
      draw();
    };
    i.src = a.url;
  } else draw();
}
function draw() {
  const c = $('#canvas'),
    x = p();
  if (!x) return;
  const v = $('#previewVideo');
  if (v) v.style.filter = 'brightness(' + x.brightness + '%) saturate(' + x.saturation + '%)';
  if (!c) return;
  const [w, h] = x.format.split(':').map(Number);
  c.width = w / h >= 1 ? 1600 : 1080;
  c.height = Math.round((c.width * h) / w);
  const ctx = c.getContext('2d');
  ctx.fillStyle = x.bg;
  ctx.fillRect(0, 0, c.width, c.height);
  if (imageObj) {
    const scale = Math.max(c.width / imageObj.width, c.height / imageObj.height),
      iw = imageObj.width * scale,
      ih = imageObj.height * scale;
    ctx.filter = 'brightness(' + x.brightness + '%) saturate(' + x.saturation + '%)';
    ctx.drawImage(imageObj, (c.width - iw) / 2, (c.height - ih) / 2, iw, ih);
    ctx.filter = 'none';
  }
  ctx.fillStyle = x.color;
  ctx.textAlign = 'center';
  ctx.font = '800 ' + x.fontSize + 'px sans-serif';
  const lines = [];
  x.text.split('\n').forEach((line) => {
    let t = '';
    line.split(' ').forEach((word) => {
      if (ctx.measureText(t + ' ' + word).width > c.width * 0.85 && t) {
        lines.push(t);
        t = word;
      } else t += (t ? ' ' : '') + word;
    });
    lines.push(t);
  });
  lines.forEach((l, i) =>
    ctx.fillText(l, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * x.fontSize * 1.2),
  );
}
function download(blob, name) {
  const u = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function exportImage() {
  if (!$('#canvas')) return toast('Este proyecto usa video. Puedes descargar el archivo original.');
  document.fonts.ready.then(() => {
    draw();
    $('#canvas').toBlob((b) => {
      if (b) download(b, p().name + '.png');
    }, 'image/png');
  });
}
function downloadProject() {
  download(
    new Blob([JSON.stringify(p(), null, 2)], { type: 'application/json' }),
    p().name + '.json',
  );
  toast('Proyecto exportado; los archivos multimedia permanecen en la biblioteca.');
}
async function copyCaption() {
  try {
    await navigator.clipboard.writeText(p().caption);
    toast('Descripción copiada');
  } catch {
    toast('Selecciona el texto para copiarlo manualmente.');
  }
}
function duplicate() {
  const x = {
    ...p(),
    id: crypto.randomUUID(),
    name: p().name + ' — copia',
    date: '',
    created: Date.now(),
  };
  projects.unshift(x);
  current = x.id;
  save();
  renderEditor();
  toast('Proyecto duplicado');
}
function deleteProject() {
  if (!confirm('¿Eliminar este proyecto?')) return;
  projects = projects.filter((x) => x.id !== current);
  current = null;
  save();
  go('projects');
}
function mark(key) {
  p()[key] = $('#previewVideo').currentTime;
  save();
  $('#clip').textContent =
    'Inicio: ' + p().start.toFixed(1) + ' s · Final: ' + p().end.toFixed(1) + ' s';
}
function playSegment() {
  if (p().end <= p().start) return toast('Marca un final posterior al inicio.');
  const v = $('#previewVideo');
  v.currentTime = p().start;
  window.segmentPlaying = true;
  v.play();
}
function downloadOriginal() {
  const a = assets.find((a) => a.id === p().asset);
  if (a) download(a.blob, a.name);
}
function importFiles() {
  $('#files').click();
}
$('#files').onchange = async (e) => {
  await ready;
  for (const file of e.target.files) {
    if (!/^(image|video|audio)\//.test(file.type)) {
      toast('Formato no compatible');
      continue;
    }
    const record = { id: crypto.randomUUID(), name: file.name, type: file.type, blob: file };
    try {
      await new Promise((resolve, reject) => {
        const t = db.transaction('files', 'readwrite');
        t.objectStore('files').put(record);
        t.oncomplete = resolve;
        t.onerror = reject;
        t.onabort = reject;
      });
      assets.push({ ...record, url: URL.createObjectURL(file) });
      if (p() && !file.type.startsWith('audio')) {
        p().asset = record.id;
        save();
      }
    } catch {
      toast('No se pudo guardar el archivo. Revisa el espacio disponible.');
    }
  }
  e.target.value = '';
  render();
  toast('Importación finalizada');
};
function useAsset(id) {
  if (!p()) {
    toast('Abre o crea un proyecto para usar este archivo.');
    newProject();
    return;
  }
  p().asset = id;
  save();
  go('editor');
}
function removeAsset(id) {
  if (!confirm('¿Eliminar el archivo de la biblioteca?')) return;
  const t = db.transaction('files', 'readwrite');
  t.objectStore('files').delete(id);
  t.oncomplete = () => {
    const a = assets.find((a) => a.id === id);
    if (a) URL.revokeObjectURL(a.url);
    assets = assets.filter((a) => a.id !== id);
    projects.forEach((p) => {
      if (p.asset === id) p.asset = null;
    });
    save();
    render();
  };
}
let month = new Date().getMonth(),
  year = new Date().getFullYear();
function moveMonth(n) {
  month += n;
  if (month < 0) {
    month = 11;
    year--;
  }
  if (month > 11) {
    month = 0;
    year++;
  }
  renderCalendar();
}
function renderCalendar() {
  const d = new Date(year, month, 1),
    offset = (d.getDay() + 6) % 7,
    days = new Date(year, month + 1, 0).getDate();
  $('main').innerHTML =
    intro(
      'Un buen contenido. Un buen plan.',
      'Organiza fechas de preparación para tus publicaciones.',
    ) +
    '<div class="section"><button onclick="moveMonth(-1)">←</button><h2>' +
    d.toLocaleDateString('es', { month: 'long', year: 'numeric' }) +
    '</h2><button onclick="moveMonth(1)">→</button></div><div class="notice">Calendario local. Las publicaciones no se envían a las redes sociales.</div><div class="calendar">' +
    ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
      .map((x) => '<div class="day head">' + x + '</div>')
      .join('') +
    Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => {
      const day = i - offset + 1;
      return (
        '<div class="day">' +
        (day > 0 && day <= days
          ? day +
            projects
              .filter((x) => {
                const dt = new Date(x.date);
                return dt.getFullYear() === year && dt.getMonth() === month && dt.getDate() === day;
              })
              .map(
                (x) =>
                  '<button class="event" onclick="openProject(\'' +
                  x.id +
                  '\')">' +
                  esc(x.name) +
                  '</button>',
              )
              .join('')
          : '') +
        '</div>'
      );
    }).join('') +
    '</div>';
}
function renderIdeas() {
  $('main').innerHTML =
    intro(
      'Las buenas historias empiezan aquí.',
      'Un espacio para pensar, escribir y encontrar tu próximo enfoque.',
    ) +
    '<div class="ideas"><section class="panel"><h3>✧ Estructura tu próximo guion</h3><label>¿De qué quieres hablar?</label><input id="topic" placeholder="Ej. Mi rutina de creación de contenido"><label>Objetivo</label><select id="goal"><option>Enseñar algo útil</option><option>Inspirar a mi audiencia</option><option>Presentar un producto</option></select><button class="primary" style="margin-top:18px" onclick="generateScript()">Crear estructura</button><p class="hint">Generador de estructuras basado en plantillas, sin conexión a IA.</p><label>Mis notas</label><textarea id="notes" style="height:200px" placeholder="Captura tus ideas…">' +
    esc(localStorage.getItem('luma-notes') || '') +
    '</textarea></section><section class="panel"><h3>Tu guion</h3><div id="script" class="script">' +
    esc(
      localStorage.getItem('luma-script') ||
        'Tu próxima historia está a una idea de distancia. Completa el tema para comenzar.',
    ) +
    "</div><button style=\"margin-top:20px\" onclick=\"download(new Blob([document.querySelector('#script').textContent],{type:'text/plain'}),'guion-fleremahias.txt')\">↓ Descargar guion</button></section></div>";
  $('#notes').oninput = (e) => localStorage.setItem('luma-notes', e.target.value);
}
function generateScript() {
  const t = $('#topic').value.trim();
  if (!t) return toast('Escribe un tema para tu guion.');
  const s =
    'TEMA: ' +
    t +
    '\nOBJETIVO: ' +
    $('#goal').value +
    '\n\n01 · GANCHO (0–3 s)\n“Esto es lo que me hubiera gustado saber sobre ' +
    t.toLowerCase() +
    '.”\n\n02 · CONTEXTO (3–8 s)\nPresenta el problema con una situación concreta de tu experiencia.\n\n03 · DESARROLLO (8–35 s)\n• Comparte tu primer consejo y muestra un ejemplo.\n• Explica el paso más importante con un plano detalle.\n• Añade un resultado real o una lección aprendida.\n\n04 · CIERRE (35–45 s)\nResume la idea en una frase y pregunta a tu audiencia qué le gustaría ver después.\n\nLISTA DE TOMAS\nPlano a cámara · Recurso del proceso · Detalle del resultado';
  $('#script').textContent = s;
  localStorage.setItem('luma-script', s);
}
go('home');
ready.then(() => render()).catch(() => toast('Biblioteca no disponible en este navegador.'));
