(function (root) {
  'use strict';
  const chapters = root.FleremahiasHelpContent.chapters,
    seenKey = 'fleremahias-guide-v1';
  const escape = (s) =>
    String(root.StudioI18n?.t(s) ?? s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const norm = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  let manual,
    card,
    ring,
    selected = 'start',
    query = '',
    mode = null,
    step = 0,
    tourSteps = [],
    previousFocus,
    frame,
    inspectionTarget;
  const chapter = (id) => chapters.find((c) => c.id === id) || chapters[0];
  const flowChapters = {
    create: 'create',
    record: 'record',
    text: 'text',
    audio: 'audio',
    tracks: 'tracks',
    design: 'covers',
    bulk: 'bulk',
    review: 'versions',
    jobs: 'jobs',
    publish: 'social',
  };
  const viewChapter = {
    board: 'board',
    home: 'home',
    projects: 'projects',
    editor: 'editor',
    library: 'projects',
    calendar: 'calendar',
    ideas: 'ideas',
    code: 'code',
    tools: 'tools',
    templates: 'templates',
    publish: 'publish',
  };
  const functionChapters = {
    newProject: 'home',
    importFiles: 'home',
    openProject: 'projects',
    duplicateProject: 'projects',
    deleteProject: 'projects',
    setTool: 'editor',
    setInspector: 'design',
    toggleEasy: 'editor',
    addScene: 'timeline',
    moveScene: 'timeline',
    duplicateScene: 'timeline',
    removeScene: 'timeline',
    togglePreview: 'timeline',
    playMontage: 'timeline',
    toggleGuide: 'timeline',
    exportVideo: 'export',
    exportCarousel: 'export',
    exportPNG: 'export',
    saveFinalVideo: 'export',
    saveSRT: 'sound',
    importSRT: 'sound',
    makeCaptions: 'sound',
    brandDialog: 'quick',
    applyBrand: 'quick',
    queueCurrent: 'publish',
    createQueueJobs: 'publish',
    prepareSelected: 'publish',
    downloadQueuePackage: 'publish',
    downloadPlanCSV: 'publish',
    queueCalendar: 'publish',
    markJobPublished: 'publish',
    copyJobCaption: 'publish',
    downloadJob: 'publish',
    shareJob: 'publish',
    removeJob: 'publish',
    selectAllJobs: 'publish',
    generateScript: 'ideas',
    moveMonth: 'calendar',
    exportICS: 'calendar',
    backupAll: 'tools',
    importBackup: 'tools',
    startPrompt: 'tools',
    resetPrompt: 'tools',
    loadLabTemplate: 'code',
    importLabCode: 'code',
    runLab: 'code',
    stopLab: 'code',
    labCommand: 'code',
    saveLabAsset: 'code',
    addElement: 'editor',
    selectLayer: 'editor',
    toggleLayer: 'editor',
    copyLayer: 'design',
    deleteLayer: 'design',
    previewTrack: 'sound',
    addMusic: 'sound',
    openMusicLibrary: 'sound',
  };
  const ids = {
    overlay: 'design',
    ratio: 'design',
    bg: 'design',
    color: 'design',
    fontSize: 'design',
    textY: 'design',
    textX: 'design',
    asset: 'design',
    sceneFit: 'design',
    sceneZoom: 'design',
    cropX: 'design',
    cropY: 'design',
    sceneTransition: 'design',
    sceneFont: 'design',
    subtitleStyle: 'design',
    start: 'timeline',
    end: 'timeline',
    duration: 'timeline',
    seek: 'timeline',
    quality: 'export',
    playBtn: 'timeline',
    exportButton: 'export',
    modeButton: 'editor',
    toolSearch: 'editor',
    subtitleText: 'sound',
    captionLines: 'sound',
    musicLoop: 'sound',
    ducking: 'sound',
    notes: 'ideas',
    topic: 'ideas',
    goal: 'ideas',
    labCode: 'code',
    labDuration: 'code',
    labFormat: 'code',
    promptText: 'tools',
    promptSpeed: 'tools',
    promptSize: 'tools',
    captionTemplate: 'publish',
    queueDate: 'publish',
    name: 'home',
    format: 'home',
    platform: 'home',
  };
  const functionDescriptions = {
    newProject:
      'Abre el formulario para crear un proyecto: nombre, formato y red social. Solo Crear proyecto confirma la creación.',
    importFiles: 'Abre el selector para importar imágenes, videos o audio a tu biblioteca local.',
    openProject: 'Abre este proyecto guardado para continuar su edición.',
    undo: 'Deshace el último cambio disponible en el historial de edición.',
    redo: 'Recupera un cambio deshecho disponible en el historial.',
    copyLayer: 'Duplica la capa seleccionada para que puedas modificar la copia.',
    deleteLayer:
      'Elimina del montaje la capa seleccionada; no borra el archivo original de la biblioteca.',
    addScene: 'Añade una escena al montaje. Después puedes elegir su medio y duración.',
    moveScene: 'Mueve esta escena una posición a la izquierda o derecha en la secuencia.',
    duplicateScene: 'Crea una copia editable de la escena actual.',
    removeScene: 'Quita esta escena del montaje. Comprueba que quieres retirarla antes de hacerlo.',
    selectLayer: 'Selecciona esta capa para mostrar sus ajustes y moverla en el lienzo.',
    toggleLayer: 'Muestra u oculta esta capa en el montaje sin borrar su archivo de origen.',
    setFilter: 'Aplica el filtro elegido a la escena actual; revisa su aspecto en el lienzo.',
    toggleEasy:
      'Alterna Modo Fácil y Modo Pro para mostrar menos o más controles. No activa una suscripción.',
    togglePreview: 'Reproduce o pausa la escena seleccionada.',
    playMontage: 'Reproduce el montaje completo, incluidas las escenas en su orden.',
    toggleGuide: 'Muestra u oculta guías visuales del lienzo; no se exportan como contenido.',
    exportVideo:
      'Genera el video completo con escenas, texto, efectos y audio. Mantén la pestaña abierta hasta obtener el enlace de descarga.',
    exportCarousel: 'Genera imágenes PNG de las escenas para preparar un carrusel.',
    saveFinalVideo: 'Descarga el montaje final que ya se ha generado.',
    makeCaptions:
      'Distribuye las líneas escritas como subtítulos temporizados en la duración del fragmento. No transcribe audio.',
    importSRT:
      'Carga un archivo de subtítulos SRT y revisa que sus tiempos coincidan con el fragmento.',
    saveSRT: 'Descarga los subtítulos con sus tiempos en formato SRT.',
    brandDialog: 'Abre el kit de marca local: configura colores, tipografía y firma.',
    applyBrand: 'Aplica los ajustes de tu kit de marca al proyecto abierto.',
    previewTrack:
      'Reproduce una muestra de esta base sintetizada para escucharla antes de añadirla.',
    addMusic: 'Genera esta base musical sintetizada y la añade al proyecto o biblioteca local.',
    openMusicLibrary: 'Abre la biblioteca para elegir o importar una pista musical.',
    queueCurrent: 'Abre la preparación local del proyecto para crear versiones destinadas a redes.',
    createQueueJobs:
      'Crea versiones y tareas de preparación para las redes seleccionadas. No publica en ellas.',
    prepareSelected:
      'Procesa las tareas marcadas de la cola y genera sus archivos finales localmente.',
    selectAllJobs: 'Marca todas las tareas de preparación para trabajar con ellas en lote.',
    removeJob: 'Quita esta tarea de la cola local. No borra una publicación de ninguna red.',
    markJobPublished:
      'Marca esta tarea como publicada en el registro local. No envía contenido a redes.',
    copyJobCaption:
      'Copia la descripción de esta tarea al portapapeles para pegarla en la red social.',
    downloadJob: 'Descarga los archivos preparados para esta tarea.',
    shareJob:
      'Abre la función de compartir del dispositivo si está disponible; tú eliges el destino y confirmas.',
    downloadQueuePackage:
      'Descarga un ZIP con las piezas y textos preparados de las tareas seleccionadas.',
    downloadPlanCSV: 'Descarga la planificación como tabla CSV para abrirla en otra herramienta.',
    queueCalendar:
      'Descarga las fechas de las tareas como calendario ICS. No programa publicaciones en redes.',
    moveMonth: 'Cambia el mes del calendario mostrado sin alterar las fechas guardadas.',
    exportICS: 'Descarga las fechas planificadas como calendario ICS.',
    generateScript:
      'Crea una estructura de guion basada en plantillas con el tema y objetivo que escribiste; no usa un servicio de IA conectado.',
    backupAll:
      'Descarga todos los proyectos y sus medios en un respaldo completo. Guarda este archivo para restaurar tu trabajo.',
    importBackup: 'Carga un respaldo compatible y agrega sus proyectos y medios a este navegador.',
    startPrompt:
      'Inicia o pausa el desplazamiento del guion del teleprompter; no graba audio ni video.',
    resetPrompt: 'Vuelve al principio del guion del teleprompter.',
    loadLabTemplate:
      'Carga el código de la plantilla seleccionada en el laboratorio. Reemplaza el texto del editor de código.',
    importLabCode: 'Carga un archivo .js en el editor del laboratorio aislado.',
    runLab:
      'Ejecuta la vista previa del código Canvas en un entorno aislado, sin acceso a proyectos ni a la red.',
    stopLab: 'Detiene la ejecución de la vista previa del laboratorio.',
    labCommand:
      'Capturar PNG crea una imagen del código; Grabar clip genera una animación sin audio de 1 a 30 segundos; Cancelar detiene la captura actual.',
    saveLabAsset:
      'Añade el recurso generado por código a la biblioteca local para usarlo en el montaje.',
  };
  const proActions = {
    split:
      'Divide la escena en la posición actual de reproducción. Si está en un extremo, divide por la mitad; conserva el archivo original.',
    duplicate: 'Duplica la escena actual.',
    rotate: 'Gira la escena o selección 90 grados.',
    flip: 'Refleja horizontal o verticalmente el contenido según la opción indicada.',
    align: 'Centra el texto o la selección en el lienzo.',
    order: 'Mueve la selección delante o detrás de otras capas.',
    'brand-all': 'Aplica tu kit de marca a las escenas del montaje.',
    audio: 'Ajusta niveles de audio con una configuración equilibrada; escucha el resultado.',
    'brand-scene':
      'Añade una escena de introducción de marca o un cierre con llamada a la acción según el botón.',
    style: 'Aplica este estilo al texto seleccionado. Revisa el resultado en la vista previa.',
    'add-text':
      'Añade una capa de texto nueva con este estilo; luego puedes editar su contenido y posición.',
    block: 'Inserta este bloque como capas editables.',
    shape: 'Añade esta forma al lienzo como capa.',
    speed: 'Cambia la velocidad de la escena. Revisa la duración y el audio después.',
    motion: 'Aplica esta animación de entrada al elemento seleccionado.',
    image: 'Descarga el lienzo en el formato de imagen indicado.',
    transparent:
      'Exporta un PNG sin fondo sólido; los medios de la escena pueden seguir ocupando el fondo.',
    assemble: 'Crea un montaje nuevo con los medios seleccionados y los pulsos por escena.',
    'fit-beat': 'Ajusta las duraciones de las escenas actuales al BPM introducido manualmente.',
    filter: 'Aplica este filtro visual a la escena.',
    background: 'Cambia el estilo de fondo con la opción indicada.',
    'reset-adjust': 'Restablece los ajustes de imagen de la escena.',
    'caption-style': 'Cambia el aspecto de los subtítulos temporizados.',
    captions: 'Distribuye el texto en bloques con tiempos; revisa su sincronización con el audio.',
    'favorite-save': 'Guarda la selección en Mis elementos de este navegador.',
    'save-selection': 'Guarda este elemento como favorito local.',
    'favorite-add': 'Añade este elemento guardado al lienzo.',
    'favorite-remove': 'Quita este favorito de Mis elementos; revisa antes de confirmar.',
  };
  function currentChapter(el) {
    if (el?.closest('.design-dialog')) return 'design-pro';
    if (el?.closest('.flow-dialog'))
      return flowChapters[document.querySelector('.flow-tabs .active')?.dataset.value] || 'create';
    if (el?.closest('.pro-dialog')) return 'quick';
    return viewChapter[typeof view === 'string' ? view : 'home'] || 'home';
  }
  function labelOf(el) {
    const associated = el.labels?.[0]?.textContent;
    return (
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      associated ||
      el.textContent ||
      el.getAttribute('placeholder') ||
      el.id ||
      'Control'
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150);
  }
  function describe(el) {
    if (el.dataset.helpDescription)
      return {
        label: labelOf(el),
        chapter: el.dataset.helpChapter || 'board',
        text: el.dataset.helpDescription,
      };
    const label = labelOf(el),
      fn = (el.getAttribute('onclick') || '').match(/\b([A-Za-z_$][\w$]*)\s*\(/)?.[1];
    let id = ids[el.id] || functionChapters[fn] || currentChapter(el);
    if (el.dataset.view) id = viewChapter[el.dataset.view] || id;
    if (el.dataset.flow === 'tab') id = flowChapters[el.dataset.value] || id;
    if (el.closest('.tool-tabs'))
      id =
        { media: 'projects', text: 'design', filters: 'quick', music: 'sound', layers: 'design' }[
          el.dataset.tool
        ] || id;
    const c = chapter(id);
    if (el.closest('#create') && el.matches('button:not([type="button"])'))
      return {
        label,
        chapter: 'home',
        text: 'Confirma el nombre, formato y red elegidos y crea un proyecto vacío editable en este navegador.',
      };
    const fieldHelp = {
      name: 'Escribe el nombre con el que identificarás tu proyecto.',
      format: 'Elige la proporción: 9:16 vertical, 1:1 cuadrado, 16:9 horizontal o 4:5 retrato.',
      platform:
        'Elige la red para la que preparas el proyecto. Esta selección no publica ni conecta una cuenta.',
      'f-name': 'Nombre del montaje que se creará a partir de tus archivos.',
      'f-duration':
        'Segundos que durará cada archivo en el montaje inicial; después puedes ajustar cada escena.',
      'f-hook': 'Escribe el título o gancho que usarás como punto de partida del contenido.',
      'f-script':
        'Escribe frases para distribuirlas en el montaje. No se transcribe ni genera voz a partir de este campo.',
      'f-prompter':
        'Texto que quieres leer mientras grabas; su desplazamiento se controla desde la grabadora.',
    };
    if (fieldHelp[el.id]) return { label, chapter: c.id, text: fieldHelp[el.id] };
    if (el.dataset.view || el.dataset.flow === 'tab' || el.closest('.tool-tabs'))
      return { label, chapter: c.id, text: c.intro || `Abre ${c.title}. ${c.controls[0][1]}` };
    if (functionDescriptions[fn]) return { label, chapter: c.id, text: functionDescriptions[fn] };
    if (el.dataset.lumaAction && proActions[el.dataset.lumaAction])
      return { label, chapter: 'quick', text: proActions[el.dataset.lumaAction] };
    if (el.dataset.flow === 'close' || el.dataset.lumaAction === 'close')
      return {
        label,
        chapter: c.id,
        text: 'Cierra este panel y vuelve al estudio. No exporta ni publica contenido.',
      };
    if (el.dataset.flow === 'cancel')
      return {
        label,
        chapter: c.id,
        text: 'Solicita cancelar el proceso actual del centro de creación. Espera a que termine la cancelación antes de cerrar.',
      };
    const text = norm(label);
    let best = null,
      score = 0;
    for (const entry of [c, ...chapters.filter((q) => q.id !== c.id)])
      for (const [name, description] of entry.controls) {
        for (const part of name.split(' / ')) {
          const key = norm(root.StudioI18n?.t(part) ?? part);
          if (!key) continue;
          const words = key.split(' ').filter((w) => w.length > 2),
            common = words.filter((w) => text.split(' ').includes(w)).length;
          const n =
            text === key
              ? 100 + key.length
              : text.includes(key) || (key.includes(text) && text.length > 3)
                ? 60 + Math.min(key.length, text.length)
                : words.length > 1 && common === words.length
                  ? 40 + common
                  : 0;
          if (n > score) {
            score = n;
            best = { label, chapter: entry.id, text: description };
          }
        }
      }
    if (best) return best;
    if (root.StudioI18n?.locale() === 'en') {
      const title = root.StudioI18n.t(c.title);
      if (el.matches('input[type="checkbox"]'))
        return {
          label,
          chapter: c.id,
          text:
            'Check or uncheck “' +
            label +
            '” in ' +
            title +
            '. Help mode does not change the selection.',
        };
      if (el.matches('select'))
        return {
          label,
          chapter: c.id,
          text:
            'Choose a value for “' +
            label +
            '”. Available options: ' +
            [...el.options]
              .slice(0, 12)
              .map((option) => option.text)
              .join(', ') +
            '. See the chapter for workflow instructions.',
        };
      if (el.matches('input,textarea'))
        return {
          label,
          chapter: c.id,
          text:
            'Edit “' +
            label +
            '” in ' +
            title +
            '. ' +
            (el.type === 'range' || el.type === 'number'
              ? 'Adjust the numeric value' +
                (el.min ? ' from ' + el.min : '') +
                (el.max ? ' to ' + el.max : '') +
                '. '
              : el.type === 'password'
                ? 'Enter only the private token for your authorized service. Do not share it. '
                : '') +
            root.StudioI18n.t(c.intro || c.controls[0][1]),
        };
    }
    if (el.matches('input[type="checkbox"]'))
      return {
        label,
        chapter: c.id,
        text: `Marca o desmarca «${label}» para incluir o excluir esta opción en ${c.title}. En este modo de ayuda la selección no cambia.`,
      };
    if (el.matches('select'))
      return {
        label,
        chapter: c.id,
        text: `Elige el valor de «${label}». Las opciones disponibles son: ${[...el.options]
          .slice(0, 12)
          .map((o) => o.text)
          .join(', ')}. Consulta el capítulo para ver cómo se usa en el flujo.`,
      };
    if (el.matches('input,textarea'))
      return {
        label,
        chapter: c.id,
        text: `Campo «${label}» de ${c.title}. ${el.type === 'range' || el.type === 'number' ? 'Ajusta el valor numérico' + (el.min ? ' desde ' + el.min : '') + (el.max ? ' hasta ' + el.max : '') + '. ' : el.type === 'password' ? 'Introduce solo el token privado del servicio autorizado; no lo compartas. ' : ''}${c.intro || c.controls[0][1]}`,
      };
    if (el.closest('.project'))
      return {
        label,
        chapter: 'projects',
        text: 'Abre este proyecto para continuar editándolo. En modo Explicar controles solo ves esta descripción.',
      };
    if (el.closest('.scene-track'))
      return {
        label,
        chapter: 'timeline',
        text: 'Selecciona esta escena o cambia su orden con las flechas. Sus ajustes aparecerán en el inspector.',
      };
    if (el.closest('.filter-tiles'))
      return {
        label,
        chapter: 'quick',
        text: 'Aplica el filtro visual indicado a la escena actual. Revisa la muestra y el lienzo.',
      };
    if (el.closest('.element-tiles,.sticker-grid'))
      return {
        label,
        chapter: 'design',
        text: 'Añade este elemento como una capa editable; luego puedes moverlo y ajustar su aspecto.',
      };
    return {
      label,
      chapter: c.id,
      text: `Este control pertenece a ${c.title}. ${c.intro || c.controls[0][1]} Abre las instrucciones de la sección para consultar sus pasos y controles.`,
    };
  }
  function seen() {
    try {
      return localStorage.getItem(seenKey) === 'seen';
    } catch {
      return false;
    }
  }
  function rememberSeen() {
    try {
      localStorage.setItem(seenKey, 'seen');
    } catch {}
  }
  function ensureManual() {
    if (manual) return;
    manual = document.createElement('dialog');
    manual.className = 'help-manual';
    manual.setAttribute('aria-labelledby', 'help-title');
    manual.dataset.helpUi = 'true';
    manual.innerHTML = `<div class="help-header"><div><small>FLEREMAHIAS STUDIO · GUÍA VIVA</small><h2 id="help-title">Crea con confianza.</h2><p id="help-intro">Busca una función o recorre el estudio paso a paso.</p></div><button data-help="close" aria-label="Cerrar guía">×</button></div><div class="help-quick"><button class="primary" data-help="tour">▶ Recorrido guiado</button><button data-help="inspect">◎ Explicar controles</button><button data-help="context">Ayuda de esta sección</button></div><label class="help-search">Buscar instrucciones<input type="search" id="help-search" placeholder="Ej. subtítulos, música, exportar, grabar…" autocomplete="off"></label><div class="help-layout"><nav class="help-index" aria-label="Capítulos de la guía"></nav><article id="help-article" tabindex="0"></article></div><div class="help-footer"><span>Escape cierra la ayuda · Siempre disponible desde Guía y ayuda</span><button data-help="close">Volver al estudio</button></div>`;
    document.body.append(manual);
    manual.addEventListener('cancel', () => rememberSeen());
    manual.addEventListener('close', () => {
      rememberSeen();
      if (!mode && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    });
    manual.querySelector('#help-search').oninput = (e) => {
      query = e.target.value;
      renderManual();
    };
    manual.onclick = (e) => {
      const b = e.target.closest('[data-help]');
      if (!b) return;
      const a = b.dataset.help;
      if (a === 'close') manual.close();
      if (a === 'chapter') {
        selected = b.dataset.chapter;
        renderManual();
      }
      if (a === 'tour') {
        manual.close();
        startTour();
      }
      if (a === 'inspect') {
        manual.close();
        startInspect();
      }
      if (a === 'context') {
        selected = currentChapter(document.querySelector('dialog[open]:not(.help-manual)'));
        query = '';
        manual.querySelector('#help-search').value = '';
        renderManual();
      }
      if (a === 'open-section') openSection(chapter(selected));
    };
  }
  function renderManual() {
    const terms = norm(query).split(' ').filter(Boolean),
      matches = chapters.filter((c) =>
        terms.every((t) =>
          norm(
            [c.title, c.intro, ...(c.steps || []), ...c.controls.flat()]
              .map((text) => root.StudioI18n?.t(text) ?? text)
              .join(' '),
          ).includes(t),
        ),
      );
    if (matches.length && !matches.some((c) => c.id === selected)) selected = matches[0].id;
    manual.querySelector('.help-index').innerHTML =
      matches
        .map(
          (c) =>
            `<button data-help="chapter" data-chapter="${c.id}" ${c.id === selected ? 'aria-current="page"' : ''}>${escape(c.title)}</button>`,
        )
        .join('') || '<p>No hay coincidencias. Prueba otra palabra.</p>';
    const c = chapter(selected);
    manual.querySelector('#help-article').innerHTML = matches.length
      ? `<small class="help-kicker">MANUAL · ${chapters.indexOf(c) + 1} / ${chapters.length}</small><h3>${escape(c.title)}</h3>${c.intro ? `<p>${escape(c.intro)}</p>` : ''}${c.steps ? `<h4>Paso a paso</h4><ol>${c.steps.map((t) => `<li>${escape(t)}</li>`).join('')}</ol>` : ''}<h4>Qué hace cada control</h4><dl>${c.controls.map(([n, d]) => `<div><dt>${escape(n)}</dt><dd>${escape(d)}</dd></div>`).join('')}</dl>${c.view || c.flow ? '<button data-help="open-section">Abrir esta sección ↗</button>' : ''}`
      : '<h3>No encontramos esa instrucción.</h3><p>Busca por nombre de sección o función: audio, CSV, grabar, capas, descargar.</p>';
    manual.querySelector('#help-article').scrollTop = 0;
  }
  function open(id = 'start', welcome = false) {
    stop();
    previousFocus = document.activeElement;
    ensureManual();
    selected = chapter(id).id;
    query = '';
    manual.querySelector('#help-search').value = '';
    manual.querySelector('#help-title').textContent = welcome
      ? 'Bienvenido a tu estudio.'
      : 'Crea con confianza.';
    manual.querySelector('#help-intro').textContent = welcome
      ? 'Empieza con el recorrido o consulta las instrucciones. Puedes volver a esta guía cuando quieras.'
      : 'Busca una función o recorre el estudio paso a paso.';
    renderManual();
    if (!manual.open) manual.showModal();
  }
  function openSection(c) {
    if (document.querySelector('dialog[open]:not(.help-manual)'))
      return toast(
        'Cierra primero el panel de trabajo para cambiar de sección. Tu guía sigue disponible.',
      );
    if (
      (typeof rendering !== 'undefined' && rendering) ||
      (typeof batchBusy !== 'undefined' && batchBusy)
    )
      return toast('Espera a que termine la exportación antes de cambiar de sección.');
    manual.close();
    if (c.flow) root.LumaFlow.open(c.flow);
    else if (c.view) go(c.view);
  }
  function ensureCard() {
    const host = document.querySelector('dialog[open]:not(.help-manual)') || document.body;
    if (card) {
      if (card.parentElement !== host) {
        if (card.matches(':popover-open')) card.hidePopover();
        if (ring.matches(':popover-open')) ring.hidePopover();
        host.append(ring, card);
      }
      return;
    }
    ring = document.createElement('div');
    ring.className = 'help-spotlight';
    ring.dataset.helpUi = 'true';
    ring.setAttribute('popover', 'manual');
    ring.setAttribute('aria-hidden', 'true');
    host.append(ring);
    card = document.createElement('section');
    card.className = 'help-live';
    card.dataset.helpUi = 'true';
    card.setAttribute('popover', 'manual');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-labelledby', 'help-live-title');
    host.append(card);
    card.onclick = (e) => {
      const b = e.target.closest('[data-help]');
      if (!b) return;
      switch (b.dataset.help) {
        case 'stop':
          stop();
          break;
        case 'next':
          step++;
          showStep();
          break;
        case 'prev':
          step = Math.max(0, step - 1);
          showStep();
          break;
        case 'manual': {
          const id = b.dataset.chapter;
          stop();
          open(id);
          break;
        }
        case 'finish':
          stop();
          open('start');
          break;
      }
    };
  }
  function showCard(title, text, meta, actions) {
    ensureCard();
    card.innerHTML = `<div class="help-live-top"><small>${escape(meta)}</small><button data-help="stop" aria-label="Cerrar recorrido">×</button></div><h3 id="help-live-title">${escape(title)}</h3><p>${escape(text)}</p>${actions}`;
    if (!card.matches(':popover-open')) card.showPopover();
  }
  function targetRing(el) {
    inspectionTarget = el;
    ensureCard();
    if (!el || !el.isConnected) {
      ring.hidePopover();
      card.style.removeProperty('top');
      return;
    }
    el.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
    if (!ring.matches(':popover-open')) ring.showPopover();
    place();
  }
  function place() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!mode || !card) return;
      if (inspectionTarget?.isConnected) {
        const r = inspectionTarget.getBoundingClientRect();
        Object.assign(ring.style, {
          left: Math.max(2, r.left - 5) + 'px',
          top: Math.max(2, r.top - 5) + 'px',
          width: Math.min(innerWidth - 4, r.width + 10) + 'px',
          height: Math.min(innerHeight - 4, r.height + 10) + 'px',
        });
        const box = card.getBoundingClientRect();
        const left = Math.max(12, Math.min(innerWidth - box.width - 12, r.left));
        const below = r.bottom + 16;
        Object.assign(card.style, {
          left: left + 'px',
          top:
            (below + box.height < innerHeight - 12
              ? below
              : Math.max(12, r.top - box.height - 16)) + 'px',
          right: 'auto',
          bottom: 'auto',
        });
      } else {
        Object.assign(card.style, { left: 'auto', top: 'auto', right: '18px', bottom: '18px' });
      }
    });
  }
  function controlSteps() {
    const modal = document.querySelector('dialog[open]:not(.help-manual)');
    const editor = document.querySelector('.creator-workspace');
    if (modal || editor) {
      const scope = modal || document.querySelector('main');
      const candidates = modal
        ? [
            ...scope.querySelectorAll(
              'header button,.pro-dialog-header button,.design-header button,.design-tabs button,.flow-tabs button,.pro-dialog-tabs button,#flow-body .flow-actions button,#pro-content button,#design-content button',
            ),
          ]
        : [
            ...scope.querySelectorAll(
              '.actions button,.tool-tabs button,.inspector-tabs button,#canvas,.timeline-panel',
            ),
          ];
      return candidates
        .filter(
          (el) =>
            !el.closest('[data-help-ui]') &&
            !el.hasAttribute('data-help-launch') &&
            el.getClientRects().length,
        )
        .slice(0, 40)
        .map((el) => ({ el, ...describe(el) }));
    }
    return [
      {
        selector: '.brand',
        label: 'Tu estudio, tu firma',
        text: 'Fleremahias Studio by fleremiasflemin. Tu espacio para crear contenido social.',
        chapter: 'start',
      },
      {
        selector: '.app > header button[onclick="importFiles()"]',
        label: 'Importa tu material',
        text: chapter('home').controls[1][1],
        chapter: 'home',
      },
      {
        selector: '.app > header button[onclick="newProject()"]',
        label: 'Crea un proyecto',
        text: chapter('home').controls[0][1],
        chapter: 'home',
      },
      ...[...document.querySelectorAll('body > aside nav button')].map((el) => ({
        el,
        ...describe(el),
      })),
      {
        selector: '[data-help-launch]',
        label: 'Tu guía siempre a mano',
        text: 'Abre Guía y ayuda para buscar instrucciones, repetir este recorrido o tocar cualquier control con Explicar controles.',
        chapter: 'start',
      },
    ];
  }
  function startTour() {
    stop();
    rememberSeen();
    mode = 'tour';
    step = 0;
    tourSteps = controlSteps();
    showStep();
  }
  function showStep() {
    if (step >= tourSteps.length) {
      showCard(
        'Ya conoces el camino.',
        'Puedes volver al manual o activar Explicar controles para conocer un botón concreto sin ejecutarlo.',
        'RECORRIDO COMPLETADO',
        '<div class="help-live-actions"><button data-help="manual" data-chapter="start">Abrir manual</button><button class="primary" data-help="stop">Empezar a crear</button></div>',
      );
      targetRing(null);
      return;
    }
    const s = tourSteps[step],
      el = s.el || document.querySelector(s.selector);
    if (!el?.isConnected) {
      step++;
      showStep();
      return;
    }
    showCard(
      s.label,
      s.text,
      `PASO ${step + 1} DE ${tourSteps.length}`,
      `<div class="help-progress"><span style="width:${Math.round(((step + 1) / tourSteps.length) * 100)}%"></span></div><div class="help-live-actions"><button data-help="prev" ${step === 0 ? 'disabled' : ''}>Anterior</button><button data-help="manual" data-chapter="${s.chapter}">Ver instrucciones</button><button class="primary" data-help="next">${step === tourSteps.length - 1 ? 'Terminar' : 'Siguiente'}</button></div>`,
    );
    targetRing(el);
    card.querySelector('[data-help="next"]').focus({ preventScroll: true });
  }
  function startInspect() {
    stop();
    rememberSeen();
    mode = 'inspect';
    document.body.classList.add('help-inspecting');
    showCard(
      'Toca un control para entenderlo.',
      'Mientras este modo esté activo, tocar un botón, campo o lienzo mostrará su explicación sin ejecutar su acción. Pulsa Escape o Cerrar para volver a editar.',
      'EXPLICAR CONTROLES · ACTIVO',
      '<div class="help-live-actions"><button data-help="manual" data-chapter="start">Abrir manual</button><button data-help="stop">Salir del modo ayuda</button></div>',
    );
    targetRing(null);
  }
  function stop() {
    mode = null;
    inspectionTarget = null;
    document.body.classList.remove('help-inspecting');
    if (card?.matches(':popover-open')) card.hidePopover();
    if (ring?.matches(':popover-open')) ring.hidePopover();
    cancelAnimationFrame(frame);
  }
  function explainEvent(e) {
    if (mode !== 'inspect' || e.target.closest('[data-help-ui]')) return;
    const el = e.target.closest('button,a,input,select,textarea,canvas,summary,[role="button"]');
    if (!el) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const d = describe(el);
    showCard(
      d.label,
      d.text,
      'EXPLICAR CONTROLES · NO SE HA ACTIVADO',
      `<div class="help-live-actions"><button data-help="manual" data-chapter="${d.chapter}">Instrucciones completas</button><button data-help="stop">Volver a editar</button></div>`,
    );
    targetRing(el);
  }
  document.addEventListener('click', explainEvent, true);
  document.addEventListener(
    'click',
    (e) => {
      if (mode === 'tour' && !e.target.closest('[data-help-ui]')) stop();
    },
    true,
  );
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && mode) {
        e.preventDefault();
        e.stopImmediatePropagation();
        stop();
      } else if (
        mode === 'inspect' &&
        (e.key === 'Enter' ||
          e.key === ' ' ||
          (e.key !== 'Tab' && e.target.matches('input,select,textarea')))
      )
        explainEvent(e);
    },
    true,
  );
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (
        mode === 'inspect' &&
        !e.target.closest('[data-help-ui]') &&
        e.target.closest('input,select,textarea,canvas')
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  addEventListener('resize', place);
  document.addEventListener('scroll', place, true);
  function launchers() {
    for (const dialog of document.querySelectorAll('dialog:not(.help-manual)')) {
      if (dialog.querySelector('[data-help-launch]')) continue;
      const host = dialog.querySelector('.pro-dialog-header,header,form,.plans-head');
      if (!host) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'help-inline';
      b.textContent = '? Ayuda';
      b.dataset.helpLaunch = 'context';
      b.setAttribute('aria-label', 'Ayuda de esta sección');
      host.append(b);
    }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-help-launch]');
    if (b) {
      e.preventDefault();
      open(b.dataset.helpLaunch === 'context' ? currentChapter(b) : 'start');
    }
  });
  new MutationObserver(launchers).observe(document.body, { childList: true, subtree: true });
  launchers();
  root.FleremahiasHelp = { open, startTour, startInspect, stop, describe };
  document.addEventListener('studio:languagechange', () => {
    if (manual?.open) {
      query = '';
      manual.querySelector('#help-search').value = '';
      renderManual();
    }
    if (mode) stop();
  });
  document.addEventListener('close', () => setTimeout(firstVisit, 150), true);
  function firstVisit() {
    if (!seen() && !document.querySelector('dialog[open]')) open('start', true);
  }
  Promise.resolve(typeof ready === 'undefined' ? null : ready).then(
    () => setTimeout(firstVisit, 650),
    () => setTimeout(firstVisit, 650),
  );
})(window);
