(function (root) {
  'use strict';
  const API = 'https://fleremahias-studio.analista-datos-pro.workers.dev',
    Core = FleremahiasCloudCore,
    key = 'fleremahias-session-v1',
    t = (es, en) => (StudioI18n.locale() === 'en' ? en : es);
  let session;
  try {
    session = JSON.parse(sessionStorage.getItem(key) || 'null');
  } catch {}
  let modal,
    tab = 'account',
    busy = false,
    socket,
    activeCloud = null,
    base = null,
    revision = 0,
    sending = false,
    applying = false,
    conflict = false,
    timer,
    reconnectTimer,
    pending = null,
    cloudList = [],
    members = [],
    presence = 0,
    imageJob = null,
    receivingUpdate = false;
  const b = (label, action, value = '', extra = '') =>
    `<button type="button" data-cloud="${action}" data-value="${esc(value)}" ${extra}>${label}</button>`;
  const input = (id, value = '', type = 'text', extra = '') =>
      `<input id="cloud-${id}" type="${type}" value="${esc(value)}" ${extra}>`,
    field = (label, body) => `<label>${label}${body}</label>`,
    val = (id) => modal.querySelector('#cloud-' + id)?.value || '';
  function stateText(message) {
    const el = modal?.querySelector('[role=status]');
    if (el) el.textContent = message;
    const badge = document.querySelector('#cloud-save-state');
    if (badge) badge.textContent = message;
  }
  function keepSession(data) {
    session = { token: data.token, user: data.user, expires: data.expires };
    sessionStorage.setItem(key, JSON.stringify(session));
    paintHeader();
  }
  async function api(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      headers: {
        ...(options.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }),
        ...(session?.token ? { Authorization: 'Bearer ' + session.token } : {}),
        ...options.headers,
      },
      signal: options.signal || AbortSignal.timeout(45000),
    });
    if (options.raw) {
      if (!response.ok) throw Error((await response.json()).error || 'Request failed');
      return response;
    }
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401)
        stateText(
          t(
            'Inicia sesión de nuevo. Tus cambios siguen en esta pestaña.',
            'Sign in again. Your changes remain in this tab.',
          ),
        );
      throw Error(data.error || 'Request failed');
    }
    return data;
  }
  function paintHeader() {
    let button = document.querySelector('#cloud-account-open');
    if (!button) {
      button = document.createElement('button');
      button.id = 'cloud-account-open';
      button.onclick = () => open();
      document.querySelector('header .header-actions,header .actions')?.prepend(button);
      if (!button.isConnected) document.querySelector('header')?.append(button);
    }
    button.textContent = session?.user
      ? '☁ ' + session.user.name
      : '☁ ' + t('Cuenta y nube', 'Account and cloud');
  }
  function disconnect() {
    clearTimeout(reconnectTimer);
    if (socket) {
      socket.onclose = null;
      socket.close();
      socket = null;
    }
    sending = false;
  }
  function close(completed = false) {
    if (busy && !completed)
      return stateText(
        t('Termina el proceso antes de cerrar.', 'Finish the operation before closing.'),
      );
    modal?.close();
  }
  function open(next = 'account') {
    tab = next;
    if (!modal) {
      modal = document.createElement('dialog');
      modal.className = 'cloud-dialog';
      modal.innerHTML = `<header><div><small>FLEREMAHIAS · CONNECTED WORKSPACE</small><h2>${t('Tu estudio, conectado.', 'Your studio, connected.')}</h2></div>${b(t('Cerrar', 'Close'), 'close')}</header><nav></nav><section id="cloud-body"></section><footer><span role="status" aria-live="polite"></span></footer>`;
      document.body.append(modal);
      modal.onclick = click;
      modal.oncancel = (e) => {
        if (busy) e.preventDefault();
      };
    }
    paint();
    if (!modal.open) modal.showModal();
    if (session && next === 'projects') refreshProjects().catch((e) => stateText(e.message));
  }
  function paint() {
    if (!modal) return;
    modal.querySelector('h2').textContent = t('Tu estudio, conectado.', 'Your studio, connected.');
    modal.querySelector('[data-cloud=close]').textContent = t('Cerrar', 'Close');
    modal.querySelector('nav').innerHTML = [
      ['account', 'Mi cuenta', 'My account'],
      ['projects', 'Proyectos privados', 'Private projects'],
      ['team', 'Coedición', 'Coediting'],
      ['images', 'Imágenes con IA', 'AI images'],
    ]
      .map(([id, es, en]) => b(t(es, en), 'tab', id, `class="${tab === id ? 'active' : ''}"`))
      .join('');
    const el = modal.querySelector('#cloud-body');
    if (location.origin !== API) {
      el.innerHTML = `<p>${t('Las passkeys pertenecen al dominio del estudio. Abre la versión de Cloudflare para iniciar sesión y sincronizar tus proyectos. La edición local aquí sigue disponible.', 'Passkeys belong to the studio domain. Open the Cloudflare version to sign in and sync projects. Local editing remains available here.')}</p><a href="${API}/?account=1" target="_blank" rel="noopener">${t('Abrir estudio conectado', 'Open connected studio')} ↗</a>`;
      return;
    }
    if (tab === 'account') {
      el.innerHTML = session
        ? `<h3>${esc(session.user.name)}</h3><p>${t('La sesión dura hasta siete días. Los proyectos en nube y sus archivos están separados por cuenta; las copias locales que ya creaste siguen en tu navegador.', 'Sessions last up to seven days. Cloud projects and files are isolated by account; local copies you already created remain in your browser.')}</p><div class="cloud-actions">${b(t('Añadir otra passkey', 'Add another passkey'), 'add-key')}${b(t('Crear códigos de recuperación', 'Create recovery codes'), 'recovery')}${b(t('Cerrar sesión', 'Sign out'), 'logout')}${b(t('Cerrar todas las sesiones', 'Sign out everywhere'), 'logout-all')}</div><p>${t('Guarda tus códigos fuera del estudio. Si pierdes todas tus passkeys y códigos no hay recuperación por correo. Los códigos se muestran una sola vez.', 'Save your codes outside the studio. If you lose every passkey and recovery code, email recovery is not available. Codes are shown only once.')}</p><div id="cloud-recovery"></div>`
        : `<p>${t('Crea una cuenta con la llave de acceso de tu dispositivo. El estudio no recibe tu huella, PIN ni contraseña del dispositivo.', 'Create an account using your device passkey. The studio does not receive your fingerprint, PIN or device password.')}</p>${field(t('Nombre visible', 'Display name'), input('name', '', 'text', 'maxlength="80" autocomplete="nickname"'))}<div class="cloud-actions">${b(t('Crear cuenta con passkey', 'Create account with passkey'), 'register')}${b(t('Entrar con passkey', 'Sign in with passkey'), 'login')}</div><details><summary>${t('Recuperar con un código', 'Recover with a code')}</summary>${field(t('Código de recuperación', 'Recovery code'), input('recovery-code', '', 'password', 'autocomplete="off"'))}${b(t('Usar código una vez', 'Use code once'), 'recover')}</details>`;
      return;
    }
    if (!session) {
      el.innerHTML = `<p>${t('Inicia sesión para usar esta sección.', 'Sign in to use this section.')}</p>${b(t('Ir a mi cuenta', 'Go to my account'), 'tab', 'account')}`;
      return;
    }
    if (tab === 'projects') {
      el.innerHTML = `<p>${t('Subir el proyecto crea una copia privada y activa la sincronización. Límite inicial: 30 proyectos, 256 MB por cuenta y 20 MB por archivo. Los cambios se guardan mientras esta pestaña permanece abierta y conectada.', 'Uploading creates a private copy and starts syncing. Initial limits: 30 projects, 256 MB per account and 20 MB per file. Changes save while this tab stays open and connected.')}</p><div class="cloud-actions">${b(t('Subir proyecto abierto', 'Upload open project'), 'upload')}${b(t('Actualizar lista', 'Refresh list'), 'refresh')}${b(t('Guardar cambios ahora', 'Save changes now'), 'sync', '', connected()?.cloud.role === 'viewer' ? 'disabled' : '')}${b(t('Descargar copia de mis cambios', 'Download my changes'), 'backup')}</div><div class="cloud-list">${cloudList.map((x) => `<article><strong>${esc(x.name)}</strong><small>${esc(x.role)} · v${x.revision} · ${new Date(x.updated).toLocaleString()}</small>${b(t('Abrir y sincronizar', 'Open and sync'), 'open', x.id)}</article>`).join('') || t('Aún no hay proyectos en esta cuenta.', 'There are no projects in this account yet.')}</div>`;
      return;
    }
    if (tab === 'team') {
      el.innerHTML = `<p>${t('Abre primero un proyecto de la nube. Los editores ven cambios en directo. Los cambios simultáneos en campos distintos se combinan; si ambos cambian el mismo campo, se conserva tu copia y se solicita resolver el conflicto.', 'Open a cloud project first. Editors see live changes. Concurrent edits to different fields merge; if both edit the same field, your copy is preserved and conflict resolution is required.')}</p><p>${t('Conexión', 'Connection')}: ${socket?.readyState === 1 ? t('En directo', 'Live') : t('Sin conexión', 'Offline')} · ${presence} ${t('participantes', 'participants')}</p><div class="cloud-actions">${b(t('Conectar al proyecto abierto', 'Connect open project'), 'connect')}${b(t('Ver miembros', 'View members'), 'members')}${b(t('Invitar editor', 'Invite editor'), 'invite', 'editor')}${b(t('Invitar lector', 'Invite viewer'), 'invite', 'viewer')}${b(t('Revocar invitaciones pendientes', 'Revoke pending invitations'), 'revoke-invites')}</div><div id="cloud-invite"></div>${field(t('Código de invitación', 'Invitation code'), input('invite-code', '', 'password', 'autocomplete="off"'))}${b(t('Aceptar invitación', 'Accept invitation'), 'accept')}<div class="cloud-list">${members.map((m) => `<article><strong>${esc(m.name)}</strong><small>${esc(m.role)}</small>${m.role !== 'owner' ? b(t('Quitar acceso', 'Remove access'), 'remove-member', m.id) : ''}</article>`).join('')}</div><h3>${t('Resolver conflicto', 'Resolve conflict')}</h3><p>${conflict ? t('Hay cambios locales pendientes de comparar. Descarga tu copia antes de elegir qué versión conservar.', 'Local changes need review. Download your copy before choosing a version.') : t('Sin conflictos detectados.', 'No conflicts detected.')}</p>${b(t('Descargar mi copia', 'Download my copy'), 'backup')}${b(t('Usar versión de nube', 'Use cloud version'), 'use-remote')}${b(t('Guardar mi versión como proyecto nuevo', 'Save my version as a new project'), 'fork')}`;
      return;
    }
    if (tab === 'images') {
      el.innerHTML = `<p>${t('Genera fotografías e ilustraciones originales con FLUX.1 Schnell en Cloudflare Workers AI. El texto se envía a Cloudflare y los resultados se guardan en tu cuenta privada. Revisa la imagen antes de publicarla.', 'Generate original photographs and illustrations with FLUX.1 Schnell on Cloudflare Workers AI. Your prompt is sent to Cloudflare and outputs are saved to your private account. Review images before publishing.')}</p>${field(t('Describe tu imagen', 'Describe your image'), '<textarea id="cloud-prompt" rows="5" maxlength="1000"></textarea>')}<p>${t('Máximo 3 intentos diarios por cuenta, 20 diarios y 100 mensuales en todo el estudio. Los intentos fallidos o cancelados consumen la reserva.', 'Maximum 3 daily attempts per account, 20 daily and 100 monthly across the studio. Failed or canceled attempts consume the reservation.')}</p><div class="cloud-actions">${b(t('Generar imagen', 'Generate image'), 'generate')}${b(t('Actualizar generaciones', 'Refresh generations'), 'images')}${b(t('Cancelar trabajo activo', 'Cancel active job'), 'cancel-image')}</div><div id="cloud-images" class="cloud-list"></div>`;
      refreshImages().catch((e) => stateText(e.message));
    }
  }
  async function perform(fn) {
    if (busy) return;
    busy = true;
    try {
      await fn();
    } catch (e) {
      stateText(e.message);
    } finally {
      busy = false;
    }
  }
  async function register(add = false) {
    if (!FleremahiasPasskeys.browserSupportsWebAuthn())
      throw Error(
        t('Este navegador no admite passkeys.', 'This browser does not support passkeys.'),
      );
    const options = await api('/accounts/v1/register/options', {
      method: 'POST',
      body: JSON.stringify({ name: val('name'), add }),
    });
    stateText(
      t(
        'Completa la creación de passkey en tu dispositivo.',
        'Complete passkey creation on your device.',
      ),
    );
    const response = await FleremahiasPasskeys.startRegistration({ optionsJSON: options.options });
    keepSession(
      await api('/accounts/v1/register/verify', {
        method: 'POST',
        body: JSON.stringify({ id: options.id, response, add }),
      }),
    );
    paint();
    stateText(
      t(
        'Cuenta conectada. Añade una segunda passkey o códigos de recuperación.',
        'Account connected. Add a second passkey or recovery codes.',
      ),
    );
  }
  async function login() {
    const options = await api('/accounts/v1/login/options', { method: 'POST', body: '{}' });
    const response = await FleremahiasPasskeys.startAuthentication({
      optionsJSON: options.options,
    });
    keepSession(
      await api('/accounts/v1/login/verify', {
        method: 'POST',
        body: JSON.stringify({ id: options.id, response }),
      }),
    );
    paint();
  }
  async function refreshProjects() {
    const data = await api('/cloud/v1/projects');
    cloudList = data.projects;
    if (modal?.open && tab === 'projects') paint();
  }
  function snapshot(projectValue = p()) {
    if (!projectValue) throw Error(t('Abre un proyecto.', 'Open a project.'));
    P.mirror(projectValue);
    return Core.documentOf(projectValue, P.sceneKeys);
  }
  function normalized(document) {
    const copy = C.normalize(document);
    copy.id = document.id;
    copy.created = document.created || Date.now();
    copy.audio = document.audio || null;
    copy.scenes.forEach((s, i) => {
      s.id = document.scenes[i].id;
      s.layers.forEach((l, j) => (l.id = document.scenes[i].layers[j].id));
    });
    copy.audioTracks?.forEach((tr, i) => (tr.id = document.audioTracks[i]?.id || tr.id));
    copy.flowNotes?.forEach((n, i) => (n.id = document.flowNotes[i]?.id || n.id));
    const old = projects.find((x) => x.id === copy.id);
    copy.activeScene = copy.scenes.some((s) => s.id === old?.activeScene)
      ? old.activeScene
      : copy.scenes[0].id;
    P.activate(copy, copy.activeScene, false);
    return copy;
  }
  function install(document, role, activate = false) {
    const copy = normalized(document);
    copy.cloud = { id: document.id, userId: session.user.id, role, revision };
    const i = projects.findIndex((x) => x.id === copy.id);
    if (i >= 0) projects[i] = copy;
    else projects.unshift(copy);
    const selected = current === copy.id || activate;
    if (activate) current = copy.id;
    applying = true;
    save();
    if (selected) {
      if (view === 'editor') renderEditor();
      else go('editor');
    }
    applying = false;
    return copy;
  }
  async function importMedia(list) {
    for (const a of list) {
      if (assets.some((x) => x.id === a.id)) continue;
      const response = await api('/cloud/v1/assets/' + a.id, { raw: true });
      const blob = await response.blob();
      assets.push({
        id: a.id,
        name: a.name,
        type: a.mime,
        blob,
        url: URL.createObjectURL(blob),
        cloudTransient: true,
        cloudOwner: session.user.id,
      });
    }
  }
  async function openProject(id, allowUnsynced = false) {
    if (!allowUnsynced && (dirty() || sending))
      throw Error(
        t(
          'Guarda o descarga los cambios pendientes antes de abrir otro proyecto.',
          'Save or download pending changes before opening another project.',
        ),
      );
    if (conflict)
      throw Error(
        t(
          'Resuelve o descarga el conflicto actual antes de cambiar.',
          'Resolve or download the current conflict before switching.',
        ),
      );
    disconnect();
    const data = await api('/cloud/v1/projects/' + id);
    await importMedia(data.media);
    activeCloud = id;
    members = [];
    revision = data.revision;
    base = structuredClone(data.document);
    conflict = false;
    install(data.document, data.role, true);
    await connect();
    stateText(t('Proyecto privado conectado.', 'Private project connected.'));
  }
  const uploadedMedia = new Map();
  async function cloudMedia(document, copyAll = false) {
    const map = new Map(),
      owner = session.user.id;
    for (const id of P.references(document).filter(Boolean)) {
      const a = assets.find((a) => a.id === id);
      if (!a) throw Error(t('Falta un archivo del proyecto.', 'A project file is missing.'));
      if (!copyAll && a.cloudTransient && a.cloudOwner === owner) continue;
      const cacheKey = owner + ':' + id;
      if (!copyAll && uploadedMedia.has(cacheKey)) {
        map.set(id, uploadedMedia.get(cacheKey));
        continue;
      }
      stateText(t('Subiendo archivo: ', 'Uploading file: ') + a.name);
      let blob = a.blob,
        name = a.name,
        type = a.type;
      if (type === 'image/svg+xml') {
        const image = new Image(),
          url = URL.createObjectURL(blob);
        try {
          image.src = url;
          await image.decode();
          const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (!blob) throw Error('SVG conversion failed');
          name = name.replace(/\.svg$/i, '') + '.png';
          type = 'image/png';
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      const stored = await api('/cloud/v1/assets', {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': type, 'X-Filename': encodeURIComponent(name) },
      });
      if (session?.user.id !== owner) throw Error('Session changed');
      map.set(id, stored.id);
      if (!copyAll) uploadedMedia.set(cacheKey, stored.id);
      assets.push({
        id: stored.id,
        name,
        type,
        blob,
        url: URL.createObjectURL(blob),
        cloudTransient: true,
        cloudOwner: owner,
      });
    }
    return map;
  }
  async function uploadProject(fork = false) {
    if (!session) throw Error('Sign in first');
    const doc = snapshot(),
      map = await cloudMedia(doc, !!p().cloud);
    const mapped = Core.mapMedia(doc, map);
    if (fork) mapped.name += ' · ' + t('mi versión', 'my version');
    const data = await api('/cloud/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ document: mapped }),
    });
    conflict = false;
    await openProject(data.id, true);
    if (modal?.open) {
      tab = 'projects';
      await refreshProjects();
    }
  }
  async function connect(reconnect = false) {
    const target = reconnect ? connected() : p();
    if (!target?.cloud || target.cloud.userId !== session?.user.id)
      throw Error(t('Abre un proyecto de esta cuenta.', 'Open a project from this account.'));
    disconnect();
    activeCloud = target.cloud.id;
    const ticket = await api('/cloud/v1/projects/' + activeCloud + '/ticket', {
        method: 'POST',
        body: '{}',
      }),
      wsURL =
        API.replace('https:', 'wss:') +
        '/cloud/v1/projects/' +
        activeCloud +
        '/live?ticket=' +
        encodeURIComponent(ticket.ticket);
    socket = new WebSocket(wsURL);
    socket.onmessage = (event) => {
      receiving = receiving
        .then(() => receive(JSON.parse(event.data)))
        .catch((e) => stateText(e.message));
    };
    socket.onopen = () => {
      stateText(t('Coedición conectada.', 'Coediting connected.'));
      schedule();
    };
    socket.onerror = () =>
      stateText(
        t(
          'Error de conexión. Tus cambios permanecen en esta pestaña.',
          'Connection error. Your changes remain in this tab.',
        ),
      );
    socket.onclose = (e) => {
      sending = false;
      stateText(
        t(
          'Sin conexión; conserva esta pestaña o descarga una copia.',
          'Offline; keep this tab open or download a copy.',
        ),
      );
      if (e.code !== 4001 && e.code !== 4003 && session)
        reconnectTimer = setTimeout(() => connect(true).catch((e) => stateText(e.message)), 5000);
    };
  }
  async function receive(data) {
    receivingUpdate = true;
    try {
      await receiveData(data);
    } finally {
      receivingUpdate = false;
      schedule();
    }
  }
  async function receiveData(data) {
    if (data.type === 'presence') {
      presence = data.count;
      return;
    }
    if (data.type === 'pong') return;
    if (data.type === 'conflict') {
      conflict = true;
      sending = false;
      stateText(
        t(
          'Conflicto: tu copia está conservada. Abre Coedición para resolverlo.',
          'Conflict: your copy is preserved. Open Coediting to resolve.',
        ),
      );
      return;
    }
    if (!['snapshot', 'update'].includes(data.type) || !data.document || !connected()) return;
    const local = snapshot(connected());
    const own = data.type === 'update' && data.id === pending?.id;
    let remote = structuredClone(data.document),
      merged = own
        ? Core.rebase(pending.sent, remote, local)
        : base
          ? Core.rebase(base, remote, local)
          : { document: remote, conflicts: [] };
    if (own) {
      sending = false;
      pending = null;
    }
    revision = data.revision;
    if (merged.conflicts.length || conflict) {
      conflict = true;
      stateText(
        t(
          'Cambios simultáneos requieren revisión; no se ha descartado tu copia.',
          'Concurrent edits need review; your copy was not discarded.',
        ),
      );
      return;
    }
    const list = (await api('/cloud/v1/projects/' + activeCloud)).media;
    await importMedia(list);
    const latest = Core.rebase(local, merged.document, snapshot(connected()));
    if (latest.conflicts.length) {
      conflict = true;
      stateText(
        t(
          'Tus cambios siguen en esta pestaña. Revisa el conflicto.',
          'Your changes remain in this tab. Review the conflict.',
        ),
      );
      return;
    }
    base = remote;
    const role = connected().cloud.role;
    install(latest.document, role);
    stateText(t('Guardado en nube', 'Saved to cloud') + ' · v' + revision);
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (!applying) timer = setTimeout(() => sync().catch((e) => stateText(e.message)), 800);
  }
  async function sync() {
    if (
      applying ||
      receivingUpdate ||
      sending ||
      conflict ||
      !session ||
      !connected() ||
      connected().cloud.userId !== session.user.id ||
      connected().cloud.role === 'viewer'
    )
      return;
    if (socket?.readyState !== 1) {
      stateText(
        t(
          'Pendiente de conexión. No cierres la pestaña.',
          'Waiting for connection. Keep this tab open.',
        ),
      );
      return;
    }
    sending = true;
    try {
      const target = connected(),
        id = activeCloud;
      const mapping = await cloudMedia(snapshot(target));
      if (id !== activeCloud || !session) throw Error('Connection changed');
      // Re-read after uploads: edits made while uploading remain in this snapshot.
      const latestTarget = connected();
      const current = Core.mapMedia(snapshot(latestTarget), mapping);
      if (mapping.size) {
        const mapped = Core.mapMedia(latestTarget, mapping);
        Object.assign(latestTarget, mapped);
      }
      const patches = Core.diff(base, current);
      if (!patches.length) {
        sending = false;
        return;
      }
      if (patches.length > 100 || JSON.stringify(patches).length > 180000) {
        const result = await api('/cloud/v1/projects/' + activeCloud, {
          method: 'PUT',
          body: JSON.stringify({ revision, document: current }),
        });
        base = result.document;
        revision = result.revision;
        sending = false;
        await connect(true);
        stateText(t('Guardado en nube', 'Saved to cloud'));
        return;
      }
      pending = { id: crypto.randomUUID(), sent: current };
      socket.send(JSON.stringify({ type: 'patch', id: pending.id, patches }));
    } catch (e) {
      sending = false;
      throw e;
    }
    stateText(t('Sincronizando…', 'Syncing…'));
  }
  let receiving = Promise.resolve(),
    imageCache = new Map();
  async function refreshImages() {
    if (!session || !modal?.querySelector('#cloud-images')) return;
    const data = await api('/images/v1/jobs');
    for (const job of data.jobs.filter((j) => j.status === 'completed' && j.asset_id)) {
      if (!imageCache.has(job.asset_id)) {
        const response = await api('/cloud/v1/assets/' + job.asset_id, { raw: true });
        const blob = await response.blob();
        imageCache.set(job.asset_id, { blob, url: URL.createObjectURL(blob) });
      }
    }
    modal.querySelector('#cloud-images').innerHTML =
      data.jobs
        .map(
          (job) =>
            `<article><strong>${esc(job.prompt)}</strong><small>${esc({ processing: t('Generando…', 'Generating…'), completed: t('Lista', 'Ready'), failed: t('Error', 'Failed'), canceled: t('Cancelada', 'Canceled') }[job.status] || job.status)}</small>${job.error ? `<p>${esc(job.error)}</p>` : ''}${imageCache.has(job.asset_id) ? `<img src="${imageCache.get(job.asset_id).url}" alt="${esc(job.prompt)}"><div class="cloud-actions">${b(t('Guardar en Medios', 'Save to Media'), 'use-image', job.asset_id)}${b(t('Descargar', 'Download'), 'download-image', job.asset_id)}</div>` : ''}</article>`,
        )
        .join('') || t('Aún no hay generaciones.', 'There are no generations yet.');
  }
  async function click(event) {
    const el = event.target.closest('[data-cloud]');
    if (!el) return;
    const action = el.dataset.cloud,
      value = el.dataset.value;
    if (action === 'close') return close();
    if (action === 'tab') {
      if (busy) return;
      tab = value;
      paint();
      if (value === 'team' && sessionStorage.getItem('fleremahias-pending-invite'))
        modal.querySelector('#cloud-invite-code').value = sessionStorage.getItem(
          'fleremahias-pending-invite',
        );
      if (value === 'projects' && session) refreshProjects().catch((e) => stateText(e.message));
      return;
    }
    await perform(async () => {
      if (action === 'register' || action === 'add-key') await register(action === 'add-key');
      if (action === 'login') await login();
      if (action === 'recover') {
        keepSession(
          await api('/accounts/v1/recover', {
            method: 'POST',
            body: JSON.stringify({ code: val('recovery-code') }),
          }),
        );
        paint();
        stateText(
          t(
            'Código utilizado. Registra otra passkey ahora.',
            'Code used. Register another passkey now.',
          ),
        );
      }
      if (action === 'recovery') {
        const data = await api('/accounts/v1/recovery', { method: 'POST', body: '{}' });
        const el = modal.querySelector('#cloud-recovery');
        el.innerHTML = `<p>${t('Guarda estos códigos en un lugar privado. Generar otros invalida los anteriores.', 'Save these codes privately. Generating new codes invalidates old ones.')}</p><textarea rows="9" readonly aria-label="Recovery codes">${data.codes.map(esc).join('\n')}</textarea>`;
      }
      if (action === 'logout' || action === 'logout-all') {
        if (
          dirty() &&
          !confirm(
            t(
              'Hay cambios sin sincronizar. Descarga una copia antes de cerrar. ¿Cerrar sesión de todos modos?',
              'There are unsynced changes. Download a copy first. Sign out anyway?',
            ),
          )
        )
          return;
        await api('/accounts/v1/' + (action === 'logout' ? 'logout' : 'logout-all'), {
          method: 'POST',
          body: '{}',
        });
        const userId = session.user.id;
        disconnect();
        session = null;
        sessionStorage.removeItem(key);
        projects = projects.filter((x) => !x.cloud || x.cloud.userId !== userId);
        const removed = assets.filter((a) => a.cloudTransient && a.cloudOwner === userId);
        removed.forEach((a) => URL.revokeObjectURL(a.url));
        assets = assets.filter((a) => !removed.includes(a));
        for (const cached of imageCache.values()) URL.revokeObjectURL(cached.url);
        imageCache.clear();
        activeCloud = null;
        cloudList = [];
        members = [];
        presence = 0;
        imageJob = null;
        uploadedMedia.clear();
        base = null;
        conflict = false;
        if (!p()) current = null;
        save();
        go('home');
        paintHeader();
        paint();
        stateText(
          t(
            'Sesión cerrada. Las copias privadas se retiraron de esta pestaña.',
            'Signed out. Private working copies were removed from this tab.',
          ),
        );
      }
      if (action === 'upload' || action === 'fork') await uploadProject(action === 'fork');
      if (action === 'refresh') await refreshProjects();
      if (action === 'open') {
        await openProject(value);
        close(true);
      }
      if (action === 'sync') {
        await sync();
        stateText(t('Sincronización solicitada.', 'Sync requested.'));
      }
      if (action === 'backup') {
        const x = connected() || p();
        if (!x) throw Error('Open a project');
        download(
          new Blob([JSON.stringify(await makeBackup([x]))], { type: 'application/json' }),
          x.name + '.private-backup.json',
        );
      }
      if (action === 'connect') await connect();
      if (action === 'members') {
        const id = p()?.cloud?.id;
        if (!id) throw Error('Open a cloud project');
        members = (await api('/cloud/v1/projects/' + id + '/members')).members;
        paint();
      }
      if (action === 'invite') {
        const id = p()?.cloud?.id;
        if (!id) throw Error('Open a cloud project');
        const result = await api('/cloud/v1/projects/' + id + '/invite', {
          method: 'POST',
          body: JSON.stringify({ role: value }),
        });
        const url = API + '/?join=' + encodeURIComponent(result.token);
        modal.querySelector('#cloud-invite').innerHTML =
          `<p>${t('Este enlace permite acceso al proyecto a una cuenta. Caduca en 24 horas y se usa una sola vez. Comparte solo con tu colaborador.', 'This link grants project access to one account. It expires in 24 hours and can be used once. Share only with your collaborator.')}</p><input readonly value="${esc(url)}" aria-label="Invitation link">`;
      }
      if (action === 'accept') {
        const code = val('invite-code')
          .trim()
          .replace(/^.*[?&]join=/, '')
          .split('&')[0];
        const result = await api('/cloud/v1/invitations/accept', {
          method: 'POST',
          body: JSON.stringify({ token: code }),
        });
        await openProject(result.projectId);
        close(true);
      }
      if (action === 'remove-member') {
        const id = p()?.cloud?.id;
        await api('/cloud/v1/projects/' + id + '/members', {
          method: 'DELETE',
          body: JSON.stringify({ userId: value }),
        });
        members = (await api('/cloud/v1/projects/' + id + '/members')).members;
        paint();
      }
      if (action === 'revoke-invites') {
        await api('/cloud/v1/projects/' + p()?.cloud?.id + '/invite', { method: 'DELETE' });
        stateText(t('Invitaciones pendientes revocadas.', 'Pending invitations revoked.'));
      }
      if (action === 'use-remote') {
        if (!activeCloud) return;
        if (
          !confirm(
            t(
              'Se usará la versión de nube. Descarga antes tu copia local si la necesitas. ¿Continuar?',
              'Use the cloud version. Download your local copy first if needed. Continue?',
            ),
          )
        )
          return;
        conflict = false;
        base = null;
        await openProject(activeCloud);
        paint();
      }
      if (action === 'generate') {
        const result = await api('/images/v1/jobs', {
          method: 'POST',
          body: JSON.stringify({ prompt: val('prompt') }),
        });
        imageJob = result.id;
        stateText(
          t(
            'Generando imagen… puedes actualizar la lista o cancelar el trabajo.',
            'Generating image… refresh the list or cancel the job.',
          ),
        );
        pollImage(result.id);
      }
      if (action === 'images') await refreshImages();
      if (action === 'cancel-image' && imageJob) {
        await api('/images/v1/jobs/' + imageJob, { method: 'DELETE' });
        stateText(
          t(
            'Trabajo cancelado. La reserva del intento no se devuelve.',
            'Job canceled. The reserved attempt is not restored.',
          ),
        );
        await refreshImages();
      }
      if (action === 'use-image') {
        const cached = imageCache.get(value);
        if (cached) {
          await storeAsset(cached.blob, 'Fleremahias-AI-' + value.slice(0, 8) + '.jpg');
          stateText(t('Imagen guardada en Medios locales.', 'Image saved to local Media.'));
        }
      }
      if (action === 'download-image') {
        const cached = imageCache.get(value);
        if (cached) download(cached.blob, 'Fleremahias-AI-' + value.slice(0, 8) + '.jpg');
      }
    });
  }
  async function pollImage(id) {
    for (let i = 0; i < 35 && session && imageJob === id; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const job = await api('/images/v1/jobs/' + id);
        if (job.status !== 'processing') {
          imageJob = null;
          if (modal?.open && tab === 'images') await refreshImages();
          stateText(
            job.status === 'completed'
              ? t(
                  'Imagen terminada y guardada en tu cuenta.',
                  'Image completed and saved to your account.',
                )
              : job.error || job.status,
          );
          return;
        }
      } catch (e) {
        stateText(e.message);
        return;
      }
    }
    stateText(
      t(
        'El trabajo sigue en la cuenta. Actualiza la lista para consultar su estado.',
        'The job remains in your account. Refresh the list to check its status.',
      ),
    );
  }
  function connected() {
    return projects.find(
      (x) => x.cloud?.id === activeCloud && x.cloud?.userId === session?.user?.id,
    );
  }
  function dirty() {
    const x = connected();
    return !!(x && base && Core.diff(base, snapshot(x)).length);
  }
  const saveBase = save;
  save = function () {
    saveBase();
    if (!applying && session && connected()) schedule();
  };
  const duplicateLocal = duplicate,
    deleteLocal = deleteProject;
  duplicate = function () {
    if (!p()?.cloud) return duplicateLocal();
    perform(() => uploadProject(true));
  };
  deleteProject = function () {
    if (!p()?.cloud) return deleteLocal();
    if (dirty() || sending) {
      open('team');
      stateText(
        t(
          'Guarda o descarga tus cambios antes de cerrar la copia.',
          'Save or download your changes before closing the copy.',
        ),
      );
      return;
    }
    const id = p().id;
    if (activeCloud === p().cloud.id) {
      disconnect();
      activeCloud = null;
      base = null;
      conflict = false;
    }
    projects = projects.filter((x) => x.id !== id);
    current = null;
    save();
    go('projects');
    toast(
      t(
        'Copia cerrada. El proyecto sigue disponible en tu cuenta.',
        'Copy closed. The project remains available in your account.',
      ),
    );
  };
  const editorBase = renderEditor;
  renderEditor = function () {
    editorBase();
    if (p()?.cloud) {
      const closeCopy = document.querySelector('[onclick="deleteProject()"]');
      if (closeCopy) closeCopy.textContent = t('Cerrar copia', 'Close working copy');
      const bar = document.createElement('div');
      bar.className = 'cloud-editor-bar';
      bar.innerHTML = `<span id="cloud-save-state">☁ ${esc(p().cloud.role)} · ${t('Proyecto privado', 'Private project')}</span>${b(t('Coedición y conflictos', 'Coediting and conflicts'), 'open-team')}`;
      bar.querySelector('button').onclick = () => open('team');
      document.querySelector('.creator-workspace')?.before(bar);
    }
  };
  window.addEventListener('beforeunload', (e) => {
    if (dirty() || sending) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  setInterval(() => {
    if (socket?.readyState === 1) socket.send(JSON.stringify({ type: 'ping' }));
  }, 30000);
  const startup = async () => {
    paintHeader();
    if (session) {
      try {
        const data = await api('/accounts/v1/me');
        session.user = data.user;
        session.expires = data.expires;
        paintHeader();
      } catch {
        session = null;
        sessionStorage.removeItem(key);
        paintHeader();
      }
    }
    const join = new URL(location.href).searchParams.get('join');
    if (join) {
      window.history.replaceState(null, '', location.pathname);
      open('team');
      if (session) modal.querySelector('#cloud-invite-code').value = join;
      else {
        sessionStorage.setItem('fleremahias-pending-invite', join);
        stateText(
          t(
            'Inicia sesión y vuelve a Coedición para aceptar la invitación.',
            'Sign in and return to Coediting to accept the invitation.',
          ),
        );
      }
    }
    if (new URL(location.href).searchParams.has('account')) open();
  };
  ready.then(startup);
  document.addEventListener('studio:languagechange', () => {
    paintHeader();
    if (modal?.open) paint();
  });
  root.FleremahiasAccounts = { open, api };
})(window);
