import puppeteer from '@cloudflare/puppeteer';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  timingSafeEqual,
} from 'node:crypto';
const uid = () => crypto.randomUUID(),
  json = (data, status = 200) =>
    Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export function equal(a, b) {
  const x = Buffer.from(a || ''),
    y = Buffer.from(b || '');
  return x.length === y.length && timingSafeEqual(x, y);
}
export function encrypt(data, secret) {
  const key = Buffer.from(secret || '', 'hex');
  if (key.length !== 32) throw Error('Falta clave de cifrado');
  const iv = randomBytes(12),
    c = createCipheriv('aes-256-gcm', key, iv),
    bytes = Buffer.concat([c.update(JSON.stringify(data)), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), bytes]).toString('base64');
}
export function decrypt(data, secret) {
  const b = Buffer.from(data, 'base64'),
    d = createDecipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString());
}
export default {
  async fetch(request, env) {
    const u = new URL(request.url),
      origin = request.headers.get('Origin'),
      allowed = (env.LUMA_ORIGINS || '').split(',').map((v) => v.trim());
    if (origin && origin !== u.origin && !allowed.includes(origin))
      return json({ error: 'Origen no permitido' }, 403);
    let response;
    if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
    else {
      if (
        !env.LUMA_SERVICE_TOKEN ||
        env.LUMA_SERVICE_TOKEN.length < 32 ||
        !/^[a-f0-9]{64}$/i.test(env.LUMA_ENCRYPTION_KEY || '')
      )
        return json({ error: 'El servicio necesita configurar sus secretos' }, 503);
      const callback = /^\/oauth\/(youtube|tiktok)\/callback$/.test(u.pathname);
      if (
        !callback &&
        !equal(request.headers.get('Authorization'), 'Bearer ' + env.LUMA_SERVICE_TOKEN)
      )
        return json({ error: 'Acceso no autorizado' }, 401);
      if (u.pathname.startsWith('/studio/')) {
        u.pathname = u.pathname.slice(7);
        response = await env.ASSETS.fetch(new Request(u, request));
      } else response = await env.STATE.get(env.STATE.idFromName('owner')).fetch(request);
    }
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', origin || u.origin);
    headers.set('Vary', 'Origin');
    headers.set(
      'Access-Control-Allow-Headers',
      'Authorization,Content-Type,X-Filename,Idempotency-Key',
    );
    headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: response.status, headers });
  },
};
export class LumaState {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.store = ctx.storage;
    this.busy = false;
  }
  async list(prefix) {
    return [...(await this.store.list({ prefix })).values()];
  }
  providers() {
    return ['youtube', 'tiktok'].filter(
      (p) =>
        this.env[p.toUpperCase() + '_CLIENT_ID'] && this.env[p.toUpperCase() + '_CLIENT_SECRET'],
    );
  }
  async save(kind, data) {
    await this.store.put(kind + ':' + data.id, data);
    return data;
  }
  async schedule() {
    const jobs = [...(await this.list('post:')), ...(await this.list('render:'))].filter((j) =>
      ['Programado', 'Pendiente'].includes(j.status),
    );
    if (jobs.length) {
      const at = Math.max(
        Date.now() + 1000,
        Math.min(...jobs.map((j) => (j.at ? Date.parse(j.at) : Date.now() + 1000))),
      );
      const existing = await this.store.getAlarm();
      if (!existing || existing > at) await this.store.setAlarm(at);
    }
  }
  async api(url, options) {
    const r = await fetch(url, options);
    const data = await r.json();
    if (!r.ok || typeof data.error === 'string' || (data.error?.code && data.error.code !== 'ok'))
      throw Error('La plataforma rechazó la solicitud');
    return data;
  }
  async refresh(account) {
    let tokens = decrypt(account.secret, this.env.LUMA_ENCRYPTION_KEY);
    if (tokens.expires > Date.now() + 60000) return tokens;
    const google = account.platform === 'youtube',
      prefix = google ? 'YOUTUBE' : 'TIKTOK',
      params = new URLSearchParams({
        client_secret: this.env[prefix + '_CLIENT_SECRET'],
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      });
    params.set(google ? 'client_id' : 'client_key', this.env[prefix + '_CLIENT_ID']);
    const data = await this.api(
      google
        ? 'https://oauth2.googleapis.com/token'
        : 'https://open.tiktokapis.com/v2/oauth/token/',
      { method: 'POST', body: params },
    );
    tokens = { ...tokens, ...data, expires: Date.now() + (data.expires_in || 3600) * 1000 };
    account.secret = encrypt(tokens, this.env.LUMA_ENCRYPTION_KEY);
    await this.save('account', account);
    return tokens;
  }
  async callback(request, provider) {
    const u = new URL(request.url),
      state = await this.store.get('oauth:' + u.searchParams.get('state'));
    await this.store.delete('oauth:' + u.searchParams.get('state'));
    if (!state || state.expires < Date.now() || state.provider !== provider)
      return json({ error: 'Autorización caducada o no válida' }, 400);
    const code = u.searchParams.get('code');
    if (!code) return json({ error: 'Permiso no concedido' }, 400);
    const google = provider === 'youtube',
      prefix = provider.toUpperCase(),
      params = new URLSearchParams({
        client_secret: this.env[prefix + '_CLIENT_SECRET'],
        code,
        grant_type: 'authorization_code',
        redirect_uri: u.origin + '/oauth/' + provider + '/callback',
      });
    params.set(google ? 'client_id' : 'client_key', this.env[prefix + '_CLIENT_ID']);
    if (google) params.set('code_verifier', state.verifier);
    const tokens = await this.api(
      google
        ? 'https://oauth2.googleapis.com/token'
        : 'https://open.tiktokapis.com/v2/oauth/token/',
      { method: 'POST', body: params },
    );
    let identity, name;
    if (google) {
      const result = await this.api(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: 'Bearer ' + tokens.access_token } },
      );
      if (!result.items?.length) throw Error('No se encontró canal');
      identity = result.items[0].id;
      name = result.items[0].snippet.title;
    } else {
      identity = tokens.open_id;
      name = 'TikTok · ' + identity.slice(-6);
    }
    const accounts = await this.list('account:'),
      old = accounts.find((a) => a.identity === identity && a.platform === provider),
      record = {
        id: old?.id || uid(),
        identity,
        name,
        platform: provider,
        secret: encrypt(
          {
            ...(old && decrypt(old.secret, this.env.LUMA_ENCRYPTION_KEY)),
            ...tokens,
            expires: Date.now() + (tokens.expires_in || 3600) * 1000,
          },
          this.env.LUMA_ENCRYPTION_KEY,
        ),
      };
    await this.save('account', record);
    return json({ message: 'Cuenta conectada. Vuelve a Luma y comprueba el servicio.' });
  }
  async post(job) {
    const account = await this.store.get('account:' + job.account),
      media = await this.env.MEDIA.get('media/' + job.media);
    if (!account || !media) throw Error('Cuenta o archivo ausente');
    const tokens = await this.refresh(account),
      auth = { Authorization: 'Bearer ' + tokens.access_token },
      type = media.httpMetadata?.contentType || 'video/webm',
      size = media.size;
    if (account.platform === 'youtube') {
      if (!job.upload) {
        const r = await fetch(
          'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
          {
            method: 'POST',
            headers: {
              ...auth,
              'Content-Type': 'application/json',
              'X-Upload-Content-Length': String(size),
              'X-Upload-Content-Type': type,
            },
            body: JSON.stringify({
              snippet: {
                title: job.caption.slice(0, 95) || 'Mi contenido',
                description: job.caption,
              },
              status: {
                privacyStatus: job.privacy || 'private',
                selfDeclaredMadeForKids: !!job.madeForKids,
              },
            }),
          },
        );
        job.upload = r.headers.get('location');
        if (!r.ok || !job.upload) throw Error('No se inició la subida');
        const u = new URL(job.upload);
        if (u.protocol !== 'https:' || !u.hostname.endsWith('.googleapis.com'))
          throw Error('Destino no válido');
        await this.save('post', job);
      }
      const data = await this.api(job.upload, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': type, 'Content-Length': String(size) },
        body: media.body,
      });
      job.remoteId = data.id;
      job.url = 'https://www.youtube.com/watch?v=' + encodeURIComponent(data.id);
      job.note = 'Visibilidad: ' + job.privacy;
      job.status = 'Publicado';
    } else {
      if (size > 64 * 1024 * 1024) throw Error('TikTok admite 64 MB en este conector');
      if (!job.remoteId) {
        const result = await this.api(
          'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
          {
            method: 'POST',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source_info: {
                source: 'FILE_UPLOAD',
                video_size: size,
                chunk_size: size,
                total_chunk_count: 1,
              },
            }),
          },
        );
        job.remoteId = result.data.publish_id;
        job.upload = result.data.upload_url;
        await this.save('post', job);
      }
      const u = new URL(job.upload);
      if (
        u.protocol !== 'https:' ||
        !/(^|\.)(tiktokapis\.com|tiktokv\.com|tiktokcdn\.com)$/.test(u.hostname)
      )
        throw Error('Destino no válido');
      const r = await fetch(job.upload, {
        method: 'PUT',
        headers: {
          'Content-Type': type,
          'Content-Length': String(size),
          'Content-Range': `bytes 0-${size - 1}/${size}`,
        },
        body: media.body,
      });
      if (!r.ok) throw Error('Falló transferencia');
      job.status = 'Borrador enviado';
      job.note = 'Completa la publicación desde la notificación de TikTok.';
    }
    await this.save('post', job);
  }
  async render(job) {
    const payloadObject = await this.env.MEDIA.get('project/' + job.id);
    if (!payloadObject) throw Error('Falta el proyecto');
    const payload = await payloadObject.json(),
      browser = await puppeteer.launch(this.env.BROWSER, { keep_alive: 300000 });
    try {
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (new URL(request.url()).origin === job.origin)
          request.continue({
            headers: {
              ...request.headers(),
              Authorization: 'Bearer ' + this.env.LUMA_SERVICE_TOKEN,
            },
          });
        else request.abort();
      });
      await page.goto(job.origin + '/studio/index.html');
      await page.waitForFunction(() => !!globalThis.LumaFlow);
      const result = await page.evaluate(
        async (data) => globalThis.LumaFlow.remoteRender({ ...data, uploadResult: true }),
        payload,
      );
      if (!result.output) throw Error('Falta resultado');
      job.output = result.output;
      job.status = 'Terminado';
      await this.save('render', job);
    } finally {
      await browser.close();
    }
  }
  async alarm() {
    if (this.busy) {
      await this.store.setAlarm(Date.now() + 5000);
      return;
    }
    this.busy = true;
    try {
      const now = Date.now();
      for (const item of await this.list('post:')) {
        if (item.status === 'Enviando') {
          item.status = 'Revisar estado';
          await this.save('post', item);
        }
      }
      for (const item of await this.list('render:')) {
        if (item.status === 'Procesando') {
          item.status = 'Interrumpido';
          await this.save('render', item);
        }
      }
      const job = (await this.list('post:')).find(
        (j) => j.status === 'Programado' && (!j.at || Date.parse(j.at) <= now),
      );
      if (job) {
        job.status = 'Enviando';
        await this.save('post', job);
        try {
          await this.post(job);
        } catch {
          job.status = 'Revisar estado';
          job.error = 'No se confirmó el envío. Comprueba la red antes de repetirlo.';
          await this.save('post', job);
        }
      } else {
        const render = (await this.list('render:')).find((j) => j.status === 'Pendiente');
        if (render) {
          render.status = 'Procesando';
          await this.save('render', render);
          try {
            await this.render(render);
          } catch {
            render.status = 'Error';
            render.error =
              'El render remoto no se completó. Revisa la cuota de Browser Run y vuelve a enviar el proyecto.';
            await this.save('render', render);
          }
        }
      }
    } finally {
      this.busy = false;
      await this.schedule();
    }
  }
  async fetch(request) {
    try {
      const u = new URL(request.url),
        path = u.pathname;
      const callback = path.match(/^\/oauth\/(youtube|tiktok)\/callback$/);
      if (callback && request.method === 'GET') return await this.callback(request, callback[1]);
      if (path === '/api/status' && request.method === 'GET')
        return json({
          version: 'Luma Cloudflare 1.0',
          providers: this.providers(),
          accounts: (await this.list('account:')).map(({ id, name, platform }) => ({
            id,
            name,
            platform,
          })),
          posts: (await this.list('post:')).map(({ upload, key, ...p }) => p),
          renders: await this.list('render:'),
        });
      if (path === '/api/media' && request.method === 'POST') {
        const type = request.headers.get('Content-Type') || '',
          size = +request.headers.get('Content-Length'),
          max = Math.min(64, +this.env.MAX_UPLOAD_MB || 64) * 1024 * 1024;
        if (!/^(image|video|audio)\//.test(type) || !size || size < 10 || size > max)
          throw Error('Formato o tamaño no permitido');
        const id = uid(),
          name = decodeURIComponent(request.headers.get('X-Filename') || 'contenido').slice(0, 180);
        await this.env.MEDIA.put('media/' + id, request.body, {
          httpMetadata: { contentType: type },
          customMetadata: { name },
        });
        return json({ id });
      }
      const media = path.match(/^\/api\/media\/([\w-]+)$/);
      if (media && request.method === 'GET') {
        const item = await this.env.MEDIA.get('media/' + media[1]);
        if (!item) return json({ error: 'Archivo ausente' }, 404);
        return new Response(item.body, {
          headers: {
            'Content-Type': item.httpMetadata?.contentType || 'application/octet-stream',
            'Content-Length': String(item.size),
            'Cache-Control': 'no-store',
          },
        });
      }
      if (path === '/api/oauth/start' && request.method === 'POST') {
        const { provider } = await request.json();
        if (!this.providers().includes(provider)) throw Error('Proveedor sin configurar');
        for (const [key, s] of await this.store.list({ prefix: 'oauth:' }))
          if (s.expires < Date.now()) await this.store.delete(key);
        const state = uid(),
          verifier = randomBytes(32).toString('base64url');
        await this.store.put('oauth:' + state, {
          provider,
          verifier,
          expires: Date.now() + 600000,
        });
        const google = provider === 'youtube',
          url = new URL(
            google
              ? 'https://accounts.google.com/o/oauth2/v2/auth'
              : 'https://www.tiktok.com/v2/auth/authorize/',
          ),
          params = {
            response_type: 'code',
            redirect_uri: u.origin + '/oauth/' + provider + '/callback',
            state,
            scope: google
              ? 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly'
              : 'video.upload,user.info.basic',
          };
        if (google)
          Object.assign(params, {
            client_id: this.env.YOUTUBE_CLIENT_ID,
            access_type: 'offline',
            prompt: 'consent',
            code_challenge_method: 'S256',
            code_challenge: createHash('sha256').update(verifier).digest('base64url'),
          });
        else params.client_key = this.env.TIKTOK_CLIENT_ID;
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        return json({ url: url.href });
      }
      if (path === '/api/renders' && request.method === 'POST') {
        const text = await request.text();
        if (text.length > 4 * 1024 * 1024) throw Error('Proyecto demasiado grande');
        const data = JSON.parse(text);
        if (
          !data.project ||
          !Array.isArray(data.project.scenes) ||
          data.project.scenes.length > 24 ||
          !Array.isArray(data.media) ||
          data.media.length > 100
        )
          throw Error('Proyecto no válido');
        for (const item of data.media)
          if (!(await this.env.MEDIA.head('media/' + item.remote))) throw Error('Falta un medio');
        const queue = await this.list('render:');
        if (queue.filter((r) => ['Pendiente', 'Procesando'].includes(r.status)).length >= 10)
          throw Error('Cola llena');
        const id = uid(),
          job = {
            id,
            name: String(data.project.name || 'Contenido').slice(0, 100),
            origin: u.origin,
            status: 'Pendiente',
            created: Date.now(),
          };
        await this.env.MEDIA.put('project/' + id, text, {
          httpMetadata: { contentType: 'application/json' },
        });
        await this.save('render', job);
        await this.schedule();
        return json({ id, status: job.status }, 202);
      }
      if (path === '/api/posts' && request.method === 'POST') {
        const data = await request.json(),
          key = request.headers.get('Idempotency-Key');
        if (!key || key.length > 100) throw Error('Falta clave de idempotencia');
        const hash = createHash('sha256').update(key).digest('hex'),
          existing = await this.store.get('idempotency:' + hash);
        if (existing) {
          const prior = await this.store.get('post:' + existing);
          return json({ id: prior.id, status: prior.status });
        }
        if (!(await this.store.get('account:' + data.account))) throw Error('Cuenta ausente');
        const media = await this.env.MEDIA.head('media/' + data.media);
        if (!media?.httpMetadata?.contentType?.startsWith('video')) throw Error('Video ausente');
        if (
          data.at &&
          (!Number.isFinite(Date.parse(data.at)) || Date.parse(data.at) < Date.now() - 60000)
        )
          throw Error('Fecha no válida');
        const job = {
          id: uid(),
          account: data.account,
          media: data.media,
          caption: String(data.caption || '').slice(0, 5000),
          privacy: ['private', 'public', 'unlisted'].includes(data.privacy)
            ? data.privacy
            : 'private',
          madeForKids: !!data.madeForKids,
          at: data.at || null,
          status: 'Programado',
          created: Date.now(),
        };
        await this.store.transaction(async (tx) => {
          const prior = await tx.get('idempotency:' + hash);
          if (prior) {
            job.id = prior;
            return;
          }
          await tx.put('post:' + job.id, job);
          await tx.put('idempotency:' + hash, job.id);
        });
        await this.schedule();
        return json({ id: job.id, status: job.status }, 202);
      }
      return json({ error: 'Ruta no disponible' }, 404);
    } catch (e) {
      return json(
        { error: 'No se pudo completar la operación. Revisa datos, permisos y configuración.' },
        400,
      );
    }
  }
}
