import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
export const CANONICAL = 'https://fleremahias-studio.analista-datos-pro.workers.dev';
export const uuid = () => crypto.randomUUID();
export const randomToken = () => b64(crypto.getRandomValues(new Uint8Array(32)));
export function b64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
export function un64(str) {
  return Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (x) => x.charCodeAt(0));
}
export async function hash(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export function fail(code, message) {
  const e = Error(message);
  e.status = code;
  throw e;
}
export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
export function origin(request, env) {
  const actual = request.headers.get('Origin') || new URL(request.url).origin;
  const allowed = [
    CANONICAL,
    'https://fleremiasflemin20-maker.github.io',
    'https://luma-social-studio-251026.keenox19.chatgpt.site',
    ...String(env.ACCOUNT_ORIGINS || '').split(','),
  ];
  if (!allowed.includes(actual)) fail(403, 'Origen no permitido / Origin not allowed');
  return actual;
}
export async function body(request, max = 100000) {
  if (+request.headers.get('Content-Length') > max)
    fail(413, 'Solicitud demasiado grande / Request too large');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'JSON requerido');
  let size = 0;
  const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      fail(413, 'Request too large');
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(all));
  } catch {
    fail(400, 'JSON no válido / Invalid JSON');
  }
}
export async function rate(db, key, limit) {
  const row = await db
    .prepare(
      'INSERT INTO studio_limits(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count',
    )
    .bind(key, limit)
    .first();
  if (!row) fail(429, 'Límite alcanzado. Inténtalo más tarde / Limit reached. Try later');
  return row.count;
}
export async function authenticate(request, env) {
  if (!env.LIBRARY_DB) fail(503, 'Database unavailable');
  const value = request.headers.get('Authorization') || '';
  if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(value)) fail(401, 'Inicia sesión / Sign in');
  const tokenHash = await hash(value.slice(7));
  const user = await env.LIBRARY_DB.prepare(
    'SELECT u.id,u.name,s.expires,s.created AS authenticatedAt FROM studio_sessions s JOIN studio_users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?',
  )
    .bind(tokenHash, Date.now())
    .first();
  if (!user) fail(401, 'Sesión caducada / Session expired');
  return { ...user, sessionHash: tokenHash };
}
async function session(db, userId) {
  const token = randomToken(),
    now = Date.now(),
    expires = now + 7 * 86400000;
  await db
    .prepare('INSERT INTO studio_sessions(hash,user_id,created,expires) VALUES(?,?,?,?)')
    .bind(await hash(token), userId, now, expires)
    .run();
  const user = await db.prepare('SELECT id,name FROM studio_users WHERE id=?').bind(userId).first();
  return { token, user, expires };
}
async function challenge(db, id, kind) {
  const row = await db
    .prepare('DELETE FROM studio_challenges WHERE id=? AND kind=? AND expires>? RETURNING *')
    .bind(id, kind, Date.now())
    .first();
  if (!row) fail(400, 'Solicitud caducada o utilizada / Request expired or already used');
  return row;
}
export async function handleAccounts(request, env) {
  let allowed;
  try {
    allowed = origin(request, env);
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), allowed);
    const db = env.LIBRARY_DB,
      path = new URL(request.url).pathname;
    if (!db) fail(503, 'Database unavailable');
    let data;
    if (path === '/accounts/v1/config' && request.method === 'GET')
      return cors(
        json({
          canonical: CANONICAL,
          passkeys: true,
          recovery: true,
          aiEnabled: env.AI_ENABLED === 'true',
        }),
        allowed,
      );
    if (
      request.method === 'POST' &&
      [
        '/accounts/v1/register/options',
        '/accounts/v1/login/options',
        '/accounts/v1/recover',
      ].includes(path)
    ) {
      const ip = await hash(request.headers.get('CF-Connecting-IP') || 'local');
      await rate(db, 'auth:' + new Date().toISOString().slice(0, 10) + ':' + ip, 60);
    }
    if (path === '/accounts/v1/register/options' && request.method === 'POST') {
      data = await body(request);
      const adding = data.add === true,
        user = adding ? await authenticate(request, env) : null,
        name = String(user?.name || data.name || '')
          .trim()
          .slice(0, 80);
      if (!name) fail(400, 'Introduce un nombre / Enter a name');
      if (
        allowed !== CANONICAL &&
        !String(env.ACCOUNT_ORIGINS || '')
          .split(',')
          .includes(allowed)
      )
        fail(400, 'Open the canonical studio to register');
      if (user && Date.now() - user.authenticatedAt > 300000)
        fail(
          403,
          'Vuelve a iniciar sesión para añadir una passkey / Sign in again to add a passkey',
        );
      const userId = user?.id || uuid(),
        rp = new URL(allowed).hostname;
      const options = await generateRegistrationOptions({
        rpName: 'Fleremahias Studio',
        rpID: rp,
        userName: name,
        userID: new TextEncoder().encode(userId),
        attestationType: 'none',
        supportedAlgorithmIDs: [-7, -257],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        excludeCredentials: user
          ? (
              await db
                .prepare('SELECT id FROM studio_credentials WHERE user_id=?')
                .bind(user.id)
                .all()
            ).results.map((c) => ({ id: c.id }))
          : [],
      });
      const id = uuid();
      await db
        .prepare(
          'INSERT INTO studio_challenges(id,kind,challenge,user_id,name,origin,expires) VALUES(?,?,?,?,?,?,?)',
        )
        .bind(
          id,
          adding ? 'add' : 'register',
          options.challenge,
          userId,
          name,
          allowed,
          Date.now() + 300000,
        )
        .run();
      return cors(json({ id, options, adding }), allowed);
    }
    if (path === '/accounts/v1/register/verify' && request.method === 'POST') {
      data = await body(request);
      const adding = data.add === true,
        user = adding ? await authenticate(request, env) : null,
        c = await challenge(db, String(data.id), adding ? 'add' : 'register');
      if (c.origin !== allowed || (adding && c.user_id !== user.id))
        fail(403, 'Registration mismatch');
      const verified = await verifyRegistrationResponse({
        response: data.response,
        expectedChallenge: c.challenge,
        expectedOrigin: c.origin,
        expectedRPID: new URL(c.origin).hostname,
        requireUserVerification: true,
        supportedAlgorithmIDs: [-7, -257],
      });
      if (!verified.verified) fail(401, 'Passkey verification failed');
      const credential = verified.registrationInfo.credential;
      if (!adding) {
        await rate(db, 'accounts-total', 10000);
        await db.batch([
          db
            .prepare('INSERT INTO studio_users(id,name,created) VALUES(?,?,?)')
            .bind(c.user_id, c.name, Date.now()),
          db
            .prepare(
              'INSERT INTO studio_credentials(id,user_id,public_key,counter,transports,created) VALUES(?,?,?,?,?,?)',
            )
            .bind(
              credential.id,
              c.user_id,
              b64(credential.publicKey),
              credential.counter,
              JSON.stringify(credential.transports || []),
              Date.now(),
            ),
        ]);
      } else
        await db
          .prepare(
            'INSERT INTO studio_credentials(id,user_id,public_key,counter,transports,created) VALUES(?,?,?,?,?,?)',
          )
          .bind(
            credential.id,
            c.user_id,
            b64(credential.publicKey),
            credential.counter,
            JSON.stringify(credential.transports || []),
            Date.now(),
          )
          .run();
      return cors(json(await session(db, c.user_id)), allowed);
    }
    if (path === '/accounts/v1/login/options' && request.method === 'POST') {
      const options = await generateAuthenticationOptions({
          rpID: new URL(allowed).hostname,
          userVerification: 'required',
        }),
        id = uuid();
      await db
        .prepare(
          'INSERT INTO studio_challenges(id,kind,challenge,origin,expires) VALUES(?,?,?,?,?)',
        )
        .bind(id, 'login', options.challenge, allowed, Date.now() + 300000)
        .run();
      return cors(json({ id, options }), allowed);
    }
    if (path === '/accounts/v1/login/verify' && request.method === 'POST') {
      data = await body(request);
      const c = await challenge(db, String(data.id), 'login');
      if (c.origin !== allowed) fail(403, 'Origin mismatch');
      const credential = await db
        .prepare('SELECT * FROM studio_credentials WHERE id=?')
        .bind(String(data.response?.id || ''))
        .first();
      if (!credential) fail(401, 'Passkey desconocida / Unknown passkey');
      const verified = await verifyAuthenticationResponse({
        response: data.response,
        expectedChallenge: c.challenge,
        expectedOrigin: c.origin,
        expectedRPID: new URL(c.origin).hostname,
        credential: {
          id: credential.id,
          publicKey: un64(credential.public_key),
          counter: credential.counter,
          transports: JSON.parse(credential.transports),
        },
        requireUserVerification: true,
      });
      if (!verified.verified) fail(401, 'Invalid passkey');
      await db
        .prepare('UPDATE studio_credentials SET counter=? WHERE id=?')
        .bind(verified.authenticationInfo.newCounter, credential.id)
        .run();
      return cors(json(await session(db, credential.user_id)), allowed);
    }
    if (path === '/accounts/v1/recover' && request.method === 'POST') {
      data = await body(request);
      const code = String(data.code || '');
      if (!/^[A-Za-z0-9_-]{43}$/.test(code)) fail(401, 'Invalid recovery code');
      const row = await db
        .prepare('DELETE FROM studio_recovery WHERE hash=? RETURNING user_id')
        .bind(await hash(code))
        .first();
      if (!row) fail(401, 'Recovery code invalid or already used');
      return cors(json(await session(db, row.user_id)), allowed);
    }
    const user = await authenticate(request, env);
    if (path === '/accounts/v1/me' && request.method === 'GET')
      return cors(
        json({
          user: { id: user.id, name: user.name },
          expires: user.expires,
          passkeys: (
            await db
              .prepare('SELECT COUNT(*) AS n FROM studio_credentials WHERE user_id=?')
              .bind(user.id)
              .first()
          ).n,
        }),
        allowed,
      );
    if (path === '/accounts/v1/logout' && request.method === 'POST') {
      await db.prepare('DELETE FROM studio_sessions WHERE hash=?').bind(user.sessionHash).run();
      return cors(json({ ok: true }), allowed);
    }
    if (path === '/accounts/v1/logout-all' && request.method === 'POST') {
      await db.prepare('DELETE FROM studio_sessions WHERE user_id=?').bind(user.id).run();
      return cors(json({ ok: true }), allowed);
    }
    if (path === '/accounts/v1/recovery' && request.method === 'POST') {
      if (Date.now() - user.authenticatedAt > 300000)
        fail(403, 'Vuelve a iniciar sesión para crear códigos / Sign in again to create codes');
      const codes = Array.from({ length: 8 }, randomToken);
      await db.batch([
        db.prepare('DELETE FROM studio_recovery WHERE user_id=?').bind(user.id),
        ...(await Promise.all(
          codes.map(async (code) =>
            db
              .prepare('INSERT INTO studio_recovery(hash,user_id,created) VALUES(?,?,?)')
              .bind(await hash(code), user.id, Date.now()),
          ),
        )),
      ]);
      return cors(
        json({
          codes,
          notice:
            'Guarda estos códigos. No se volverán a mostrar / Save these codes. They will not be shown again.',
        }),
        allowed,
      );
    }
    return cors(json({ error: 'Route not found' }, 404), allowed);
  } catch (error) {
    return cors(
      json(
        {
          error: error.status
            ? error.message
            : 'No se pudo verificar la cuenta / Account verification failed',
        },
        error.status || 400,
      ),
      allowed,
    );
  }
}
export function cors(response, allowed) {
  if (!allowed) return response;
  const h = new Headers(response.headers);
  h.set('Access-Control-Allow-Origin', allowed);
  h.set('Vary', 'Origin');
  h.set('Access-Control-Allow-Headers', 'Authorization,Content-Type,If-Match');
  h.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  return new Response(response.body, { status: response.status, headers: h });
}
