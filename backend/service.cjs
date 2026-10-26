/* Single-owner companion service. Persistent jobs; credentials never enter the static site. */
const http = require('node:http'),
  fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const uuid = () => crypto.randomUUID();
function seal(value, key) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv('aes-256-gcm', key, iv),
    data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
function unseal(value, key) {
  const b = Buffer.from(value, 'base64'),
    decipher = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString());
}
function safeEqual(a, b) {
  const x = Buffer.from(a || ''),
    y = Buffer.from(b || '');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
async function body(req, max = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > max) throw Error('Archivo demasiado grande');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
function createService(config = {}) {
  const env = config.env || process.env,
    token = env.LUMA_SERVICE_TOKEN,
    key = Buffer.from(env.LUMA_ENCRYPTION_KEY || '', 'hex');
  if (!token || token.length < 32 || key.length !== 32)
    throw Error(
      'Configura LUMA_SERVICE_TOKEN (32 caracteres mínimo) y LUMA_ENCRYPTION_KEY (64 hex).',
    );
  const dir = path.resolve(config.dataDir || env.LUMA_DATA || path.join(__dirname, 'data'));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stateFile = path.join(dir, 'state.json'),
    db = fs.existsSync(stateFile)
      ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
      : { accounts: [], media: [], posts: [], renders: [] };
  db.renders ||= [];
  for (const p of db.posts) if (p.status === 'Enviando') p.status = 'Revisar estado';
  for (const r of db.renders) if (r.status === 'Procesando') r.status = 'Interrumpido';
  const save = () => {
    fs.writeFileSync(stateFile + '.tmp', JSON.stringify(db), { mode: 0o600 });
    fs.renameSync(stateFile + '.tmp', stateFile);
  };
  save();
  const originList = (env.LUMA_ORIGINS || 'https://fleremiasflemin20-maker.github.io')
      .split(',')
      .map((v) => v.trim()),
    sessions = new Map();
  const port = +env.PORT || 4180,
    base = env.LUMA_PUBLIC_URL || 'http://127.0.0.1:' + port,
    providers = ['youtube', 'tiktok'].filter(
      (p) => env[p.toUpperCase() + '_CLIENT_ID'] && env[p.toUpperCase() + '_CLIENT_SECRET'],
    );
  const redirect = (provider) => base + '/oauth/' + provider + '/callback';
  const safeAccount = (a) => ({ id: a.id, name: a.name, platform: a.platform });
  const response = (res, data, status = 200) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(data));
  };
  async function api(url, options) {
    const r = await fetch(url, { ...options, signal: AbortSignal.timeout(180000) });
    const data = await r.json();
    if (!r.ok || (data.error?.code && data.error.code !== 'ok') || typeof data.error === 'string')
      throw Error('La plataforma rechazó la solicitud. Revisa permisos, cuota y formato.');
    return data;
  }
  async function refresh(account) {
    let tokens = unseal(account.secret, key);
    if (tokens.expires > Date.now() + 60000) return tokens;
    const google = account.platform === 'youtube',
      prefix = google ? 'YOUTUBE' : 'TIKTOK',
      params = new URLSearchParams({
        client_id: env[prefix + '_CLIENT_ID'],
        client_secret: env[prefix + '_CLIENT_SECRET'],
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      });
    if (!google) {
      params.delete('client_id');
      params.set('client_key', env.TIKTOK_CLIENT_ID);
    }
    const data = await api(
      google
        ? 'https://oauth2.googleapis.com/token'
        : 'https://open.tiktokapis.com/v2/oauth/token/',
      { method: 'POST', body: params },
    );
    tokens = { ...tokens, ...data, expires: Date.now() + (data.expires_in || 3600) * 1000 };
    account.secret = seal(tokens, key);
    save();
    return tokens;
  }
  async function post(job) {
    const account = db.accounts.find((a) => a.id === job.account),
      media = db.media.find((m) => m.id === job.media);
    if (!account || !media) throw Error('Cuenta o archivo ausente');
    const tokens = await refresh(account),
      auth = { Authorization: 'Bearer ' + tokens.access_token },
      bytes = fs.readFileSync(path.join(dir, media.id));
    if (account.platform === 'youtube') {
      if (!job.upload) {
        const r = await fetch(
          'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
          {
            method: 'POST',
            headers: {
              ...auth,
              'Content-Type': 'application/json',
              'X-Upload-Content-Length': String(bytes.length),
              'X-Upload-Content-Type': media.type,
            },
            body: JSON.stringify({
              snippet: {
                title: job.title || job.caption.slice(0, 95) || media.name.slice(0, 95),
                description: job.caption,
              },
              status: {
                privacyStatus: job.privacy || 'private',
                selfDeclaredMadeForKids: !!job.madeForKids,
              },
            }),
            signal: AbortSignal.timeout(30000),
          },
        );
        if (!r.ok) throw Error('YouTube rechazó el inicio de subida');
        job.upload = r.headers.get('location');
        if (!job.upload) throw Error('YouTube no devolvió sesión de subida');
        const u = new URL(job.upload);
        if (u.protocol !== 'https:' || !u.hostname.endsWith('.googleapis.com'))
          throw Error('Sesión de subida no válida');
        save();
      }
      const result = await api(job.upload, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': media.type, 'Content-Length': String(bytes.length) },
        body: bytes,
      });
      job.remoteId = result.id;
      job.url = 'https://www.youtube.com/watch?v=' + encodeURIComponent(result.id);
      job.status = 'Publicado';
      job.note = 'Visibilidad: ' + (job.privacy || 'private');
    } else {
      if (bytes.length > 64 * 1024 * 1024)
        throw Error('Este conector de borradores TikTok admite hasta 64 MB por archivo');
      if (!job.remoteId) {
        const result = await api('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_info: {
              source: 'FILE_UPLOAD',
              video_size: bytes.length,
              chunk_size: bytes.length,
              total_chunk_count: 1,
            },
          }),
        });
        job.remoteId = result.data.publish_id;
        job.upload = result.data.upload_url;
        save();
      }
      const u = new URL(job.upload);
      if (
        u.protocol !== 'https:' ||
        !/(^|\.)(tiktokapis\.com|tiktokv\.com|tiktokcdn\.com)$/.test(u.hostname)
      )
        throw Error('Destino TikTok no válido');
      const r = await fetch(job.upload, {
        method: 'PUT',
        headers: {
          'Content-Type': media.type,
          'Content-Length': String(bytes.length),
          'Content-Range': `bytes 0-${bytes.length - 1}/${bytes.length}`,
        },
        body: bytes,
        signal: AbortSignal.timeout(180000),
      });
      if (!r.ok) throw Error('La transferencia a TikTok falló');
      job.status = 'Borrador enviado';
      job.note = 'Abre la notificación de TikTok para revisar y completar la publicación.';
    }
    save();
  }
  let working = false;
  async function tick() {
    if (working) return;
    working = true;
    try {
      const job = db.posts.find(
        (p) => p.status === 'Programado' && (!p.at || Date.parse(p.at) <= Date.now()),
      );
      if (job) {
        job.status = 'Enviando';
        save();
        try {
          await post(job);
        } catch {
          job.status = 'Revisar estado';
          job.error =
            'No se confirmó la publicación. Revisa la plataforma antes de reintentar para evitar duplicados.';
          save();
        }
      }
      const render = db.renders.find((r) => r.status === 'Pendiente');
      if (render) {
        render.status = 'Procesando';
        save();
        try {
          await renderProject(render);
          render.status = 'Terminado';
        } catch (e) {
          render.status = 'Error';
          render.error = String(e.message).slice(0, 300);
        }
        save();
      }
    } finally {
      working = false;
    }
  }
  async function renderProject(job) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required'],
    });
    try {
      const context = await browser.newContext();
      await context.route('**/*', (route) => {
        if (new URL(route.request().url()).origin === new URL(base).origin)
          return route.continue({
            headers: { ...route.request().headers(), Authorization: 'Bearer ' + token },
          });
        return route.abort();
      });
      const page = await context.newPage();
      await page.goto(base + '/studio/index.html');
      await page.waitForFunction(() => !!globalThis.LumaFlow);
      const result = await page.evaluate(
        async (payload) => globalThis.LumaFlow.remoteRender(payload),
        { project: job.project, media: job.media },
      );
      const bytes = Buffer.from(result.base64, 'base64'),
        id = uuid();
      fs.writeFileSync(path.join(dir, id), bytes, { mode: 0o600 });
      db.media.push({ id, name: result.name, type: result.type, size: bytes.length });
      job.output = id;
    } finally {
      await browser.close();
    }
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, base),
        origin = req.headers.origin;
      if (origin && !originList.includes(origin))
        return response(res, { error: 'Origen no permitido' }, 403);
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization,Content-Type,X-Filename,Idempotency-Key',
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }
      const callback = url.pathname.match(/^\/oauth\/(youtube|tiktok)\/callback$/);
      if (callback && req.method === 'GET') {
        const state = sessions.get(url.searchParams.get('state'));
        sessions.delete(url.searchParams.get('state'));
        if (!state || state.expires < Date.now() || state.provider !== callback[1])
          return response(res, { error: 'Autorización caducada o no válida' }, 400);
        const code = url.searchParams.get('code');
        if (!code) return response(res, { error: 'Permiso no concedido' }, 400);
        const provider = state.provider,
          google = provider === 'youtube',
          params = new URLSearchParams({
            client_id: env[provider.toUpperCase() + '_CLIENT_ID'],
            client_secret: env[provider.toUpperCase() + '_CLIENT_SECRET'],
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirect(provider),
          });
        if (google) params.set('code_verifier', state.verifier);
        else {
          params.delete('client_id');
          params.set('client_key', env.TIKTOK_CLIENT_ID);
        }
        const tokens = await api(
          google
            ? 'https://oauth2.googleapis.com/token'
            : 'https://open.tiktokapis.com/v2/oauth/token/',
          { method: 'POST', body: params },
        );
        let identity, name;
        if (google) {
          const data = await api(
            'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
            { headers: { Authorization: 'Bearer ' + tokens.access_token } },
          );
          if (!data.items?.length) throw Error('No se encontró un canal');
          identity = data.items[0].id;
          name = data.items[0].snippet.title;
        } else {
          identity = tokens.open_id;
          name = 'TikTok · ' + identity.slice(-6);
        }
        tokens.expires = Date.now() + (tokens.expires_in || 3600) * 1000;
        const old = db.accounts.find((a) => a.identity === identity && a.platform === provider);
        const record = {
          id: old?.id || uuid(),
          identity,
          name,
          platform: provider,
          secret: seal({ ...(old && unseal(old.secret, key)), ...tokens }, key),
        };
        if (old) Object.assign(old, record);
        else db.accounts.push(record);
        save();
        return response(res, {
          message: 'Cuenta conectada. Vuelve a Luma y pulsa Comprobar servicio.',
        });
      }
      if (!safeEqual(req.headers.authorization, 'Bearer ' + token))
        return response(res, { error: 'Acceso no autorizado' }, 401);
      if (url.pathname === '/api/status' && req.method === 'GET')
        return response(res, {
          version: 'Luma service 1.0',
          providers,
          accounts: db.accounts.map(safeAccount),
          posts: db.posts.map(({ upload, ...p }) => p),
          renders: db.renders.map(({ project, media, ...r }) => r),
        });
      if (url.pathname.startsWith('/studio/') && req.method === 'GET') {
        const rel = url.pathname.slice(8),
          file = path.resolve(__dirname, '../dist', rel);
        if (!file.startsWith(path.resolve(__dirname, '../dist') + path.sep) || !fs.existsSync(file))
          return response(res, { error: 'Archivo ausente' }, 404);
        res.setHeader(
          'Content-Type',
          file.endsWith('.js')
            ? 'text/javascript'
            : file.endsWith('.css')
              ? 'text/css'
              : 'text/html',
        );
        return fs.createReadStream(file).pipe(res);
      }
      if (url.pathname === '/api/oauth/start' && req.method === 'POST') {
        const data = JSON.parse((await body(req)).toString());
        if (!providers.includes(data.provider)) throw Error('Proveedor no configurado');
        for (const [id, s] of sessions) if (s.expires < Date.now()) sessions.delete(id);
        const state = uuid(),
          verifier = crypto.randomBytes(32).toString('base64url');
        sessions.set(state, { provider: data.provider, expires: Date.now() + 600000, verifier });
        const google = data.provider === 'youtube',
          auth = new URL(
            google
              ? 'https://accounts.google.com/o/oauth2/v2/auth'
              : 'https://www.tiktok.com/v2/auth/authorize/',
          );
        const params = {
          response_type: 'code',
          redirect_uri: redirect(data.provider),
          state,
          scope: google
            ? 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly'
            : 'video.upload,user.info.basic',
        };
        if (google)
          Object.assign(params, {
            client_id: env.YOUTUBE_CLIENT_ID,
            access_type: 'offline',
            prompt: 'consent',
            code_challenge_method: 'S256',
            code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
          });
        else params.client_key = env.TIKTOK_CLIENT_ID;
        Object.entries(params).forEach(([k, v]) => auth.searchParams.set(k, v));
        return response(res, { url: auth.href });
      }
      if (url.pathname === '/api/media' && req.method === 'POST') {
        const type = req.headers['content-type'] || '';
        if (!/^(video|audio|image)\//.test(type)) throw Error('Formato no compatible');
        const bytes = await body(req, 200 * 1024 * 1024),
          id = uuid(),
          name = decodeURIComponent(req.headers['x-filename'] || 'contenido').slice(0, 180);
        if (bytes.length < 10) throw Error('Archivo vacío');
        fs.writeFileSync(path.join(dir, id), bytes, { mode: 0o600 });
        db.media.push({ id, type, name, size: bytes.length });
        save();
        return response(res, { id });
      }
      const mediaRoute = url.pathname.match(/^\/api\/media\/([\w-]+)$/);
      if (mediaRoute && req.method === 'GET') {
        const media = db.media.find((m) => m.id === mediaRoute[1]);
        if (!media) return response(res, { error: 'Archivo ausente' }, 404);
        res.writeHead(200, {
          'Content-Type': media.type,
          'Content-Length': media.size,
          'Cache-Control': 'no-store',
        });
        return fs.createReadStream(path.join(dir, media.id)).pipe(res);
      }
      if (url.pathname === '/api/renders' && req.method === 'POST') {
        const data = JSON.parse((await body(req, 8 * 1024 * 1024)).toString());
        if (
          !data.project ||
          !Array.isArray(data.media) ||
          !data.media.every((m) => db.media.some((a) => a.id === m.remote))
        )
          throw Error('Proyecto o medios no válidos');
        if (db.renders.filter((r) => ['Pendiente', 'Procesando'].includes(r.status)).length >= 20)
          throw Error('La cola de render está llena');
        const job = {
          id: uuid(),
          status: 'Pendiente',
          project: data.project,
          media: data.media,
          created: Date.now(),
        };
        db.renders.push(job);
        save();
        return response(res, { id: job.id, status: job.status }, 202);
      }
      if (url.pathname === '/api/posts' && req.method === 'POST') {
        const data = JSON.parse((await body(req)).toString()),
          idempotency = req.headers['idempotency-key'];
        if (!idempotency || idempotency.length > 100) throw Error('Falta clave de idempotencia');
        const existing = db.posts.find((p) => p.key === idempotency);
        if (existing) return response(res, existing);
        if (
          !db.accounts.some((a) => a.id === data.account) ||
          !db.media.some((m) => m.id === data.media && m.type.startsWith('video'))
        )
          throw Error('Cuenta o video no válidos');
        if (
          data.at &&
          (!Number.isFinite(Date.parse(data.at)) || Date.parse(data.at) < Date.now() - 60000)
        )
          throw Error('Fecha no válida');
        const job = {
          id: uuid(),
          key: idempotency,
          account: data.account,
          media: data.media,
          caption: String(data.caption || '').slice(0, 5000),
          privacy: ['public', 'unlisted', 'private'].includes(data.privacy)
            ? data.privacy
            : 'private',
          madeForKids: !!data.madeForKids,
          at: data.at || null,
          status: 'Programado',
          created: Date.now(),
        };
        db.posts.push(job);
        save();
        return response(res, { id: job.id, status: job.status }, 202);
      }
      return response(res, { error: 'Ruta no disponible' }, 404);
    } catch {
      if (!res.headersSent)
        response(
          res,
          {
            error:
              'No se pudo completar la operación. Revisa la configuración, permisos y datos de entrada.',
          },
          400,
        );
      else res.end();
    }
  });
  const interval = config.noScheduler ? null : setInterval(() => tick().catch(() => {}), 5000);
  interval?.unref();
  server.on('close', () => {
    if (interval) clearInterval(interval);
  });
  return { server, tick, db, seal: (v) => seal(v, key) };
}
if (require.main === module) {
  try {
    const { server } = createService();
    server.listen(+process.env.PORT || 4180, process.env.LUMA_BIND || '127.0.0.1', () =>
      console.log('Luma service ready'),
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = { createService, seal, unseal, safeEqual };
