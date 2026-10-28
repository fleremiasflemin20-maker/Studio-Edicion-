/** Private short-lived review links. A capability shares only explicitly selected exports. */
const PREFIX = '/review/v1/',
  MAX_UPLOAD = 20 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{32}$/;
const MIMES = new Set(['image/png', 'image/jpeg', 'video/mp4', 'video/webm']);
const LOCAL = [
  'http://127.0.0.1:4182',
  'http://127.0.0.1:4183',
  'http://localhost:4182',
  'http://localhost:4183',
];
function fail(status, message) {
  const error = Error(message);
  error.status = status;
  throw error;
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
function text(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim()
    .slice(0, max);
}
export function normalizeReview(value = {}) {
  const title = text(value.title, 160);
  if (!title) fail(400, 'A review title is required.');
  const project = value.project && typeof value.project === 'object' ? value.project : {};
  const assetKeys = Array.isArray(value.assetKeys) ? [...new Set(value.assetKeys)] : [];
  if (
    assetKeys.length > 5 ||
    assetKeys.some(
      (key) =>
        typeof key !== 'string' || !key.startsWith('reviews/uploads/') || !UUID.test(key.slice(16)),
    )
  )
    fail(400, 'Choose at most five uploaded review files.');
  const number = (v, a, b, d) => (Number.isFinite(+v) ? Math.max(a, Math.min(b, +v)) : d);
  return {
    title,
    caption: text(value.caption, 4000),
    project: {
      name: text(project.name || title, 160),
      format: ['9:16', '16:9', '1:1', '4:5'].includes(project.format) ? project.format : '9:16',
      sceneCount: Math.round(number(project.sceneCount, 0, 24, 0)),
      duration: number(project.duration, 0, 120, 0),
    },
    assetKeys,
    expiresHours: number(value.expiresHours, 1, 72, 72),
  };
}
export async function tokenHash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, '0')).join('');
}
function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
function originFor(request, env) {
  const url = new URL(request.url),
    origin = request.headers.get('Origin') || url.origin;
  const configured = String(
    env.REVIEW_ORIGINS || env.CATALOG_ADMIN_ORIGINS || env.LUMA_ORIGINS || '',
  )
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const allowed = new Set([
    url.origin,
    ...LOCAL,
    ...configured,
    'https://fleremahias-studio.analista-datos-pro.workers.dev',
    'https://fleremiasflemin20-maker.github.io',
    'https://luma-social-studio-251026.keenox19.chatgpt.site',
  ]);
  if (!allowed.has(origin)) fail(403, 'Origin not allowed.');
  return origin;
}
async function authorize(request, env, origin) {
  const token = request.headers.get('Authorization');
  if (!/^Bearer [^\s]{8,500}$/.test(token || '')) fail(401, 'Owner authorization required.');
  if (!env.PRIVATE_SERVICE?.fetch) fail(503, 'Owner authentication service is unavailable.');
  const health = new URL('/api/health', request.url),
    response = await env.PRIVATE_SERVICE.fetch(
      new Request(health, {
        headers: { Authorization: token, Origin: origin },
        signal: AbortSignal.timeout(10000),
      }),
    );
  if (!response.ok)
    fail(
      response.status === 403 ? 403 : response.status === 401 ? 401 : 503,
      'Owner authorization could not be verified.',
    );
}
async function readBytes(request, max) {
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || +length > max))
    fail(413, 'File exceeds the permitted size.');
  if (!request.body) fail(400, 'Request body is empty.');
  const buffer = new Uint8Array(length !== null ? +length : max),
    reader = request.body.getReader();
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > max || size + value.byteLength > buffer.byteLength) {
        await reader.cancel();
        fail(413, 'File exceeds the permitted size.');
      }
      buffer.set(value, size);
      size += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) fail(400, 'Request body is empty.');
  if (length !== null && size !== +length)
    fail(400, 'Content length does not match the uploaded file.');
  return buffer.subarray(0, size);
}
async function readJSON(request, max = 128 * 1024) {
  const bytes = await readBytes(request, max);
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value))
      fail(400, 'Expected a JSON object.');
    return value;
  } catch {
    fail(400, 'Invalid JSON.');
  }
}
function verifyType(bytes, mime) {
  const string = (a, b) => String.fromCharCode(...bytes.subarray(a, b));
  return mime === 'image/png'
    ? bytes.length >= 8 && string(0, 8) === '\x89PNG\r\n\x1a\n'
    : mime === 'image/jpeg'
      ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === 'video/mp4'
        ? bytes.length >= 12 && string(4, 8) === 'ftyp'
        : mime === 'video/webm'
          ? bytes.length >= 4 &&
            bytes[0] === 26 &&
            bytes[1] === 69 &&
            bytes[2] === 223 &&
            bytes[3] === 163
          : false;
}
async function all(statement) {
  const result = await statement.all();
  return result.results || [];
}
async function getShare(db, token, now) {
  if (!TOKEN.test(token)) fail(404, 'Review link not found.');
  const hash = await tokenHash(token),
    share = await db.prepare('SELECT * FROM review_shares WHERE token_hash=?').bind(hash).first();
  if (!share) fail(404, 'Review link not found.');
  if (share.revoked || share.expires_at <= now)
    fail(410, 'This review link has expired or was revoked.');
  return { share, hash };
}
async function cleanMedia(env, hash) {
  await env.LIBRARY_DB.prepare('DELETE FROM review_comments WHERE share_hash=?').bind(hash).run();
  const uploads = await all(
    env.LIBRARY_DB.prepare('SELECT * FROM review_uploads WHERE share_hash=?').bind(hash),
  );
  let pending = false;
  for (const upload of uploads) {
    try {
      await env.REVIEW_MEDIA.delete(upload.object_key);
      await env.LIBRARY_DB.prepare('DELETE FROM review_uploads WHERE id=? AND share_hash=?')
        .bind(upload.id, hash)
        .run();
    } catch {
      pending = true;
    }
  }
  return pending;
}
export async function cleanupReview(env, now = Date.now()) {
  if (!env.LIBRARY_DB || !env.REVIEW_MEDIA) return;
  const expired = await all(
    env.LIBRARY_DB.prepare(
      'SELECT token_hash FROM review_shares WHERE (revoked=1 OR expires_at<=?) AND EXISTS (SELECT 1 FROM review_uploads WHERE share_hash=review_shares.token_hash) LIMIT 20',
    ).bind(now),
  );
  for (const row of expired) {
    await env.LIBRARY_DB.prepare(
      `UPDATE review_shares SET revoked=1,title='',caption='',project_json='{}' WHERE token_hash=?`,
    )
      .bind(row.token_hash)
      .run();
    await cleanMedia(env, row.token_hash);
  }
  const orphaned = await all(
    env.LIBRARY_DB.prepare(
      'SELECT * FROM review_uploads WHERE share_hash IS NULL AND created_at<=? LIMIT 20',
    ).bind(now - 72 * 3600000),
  );
  for (const upload of orphaned) {
    try {
      await env.REVIEW_MEDIA.delete(upload.object_key);
      await env.LIBRARY_DB.prepare('DELETE FROM review_uploads WHERE id=? AND share_hash IS NULL')
        .bind(upload.id)
        .run();
    } catch {}
  }
}
async function route(request, env, origin) {
  const url = new URL(request.url),
    path = url.pathname.slice(PREFIX.length),
    now = Date.now(),
    db = env.LIBRARY_DB;
  if (!db || !env.REVIEW_MEDIA) fail(503, 'Review storage is not configured.');
  if (path === 'create' && request.method === 'POST') {
    await authorize(request, env, origin);
    const data = normalizeReview(await readJSON(request));
    await cleanupReview(env, now);
    const uploads = [];
    for (const key of data.assetKeys) {
      const row = await db
        .prepare('SELECT * FROM review_uploads WHERE object_key=? AND share_hash IS NULL')
        .bind(key)
        .first();
      if (!row || !(await env.REVIEW_MEDIA.head(key)))
        fail(400, 'A review file is missing or already belongs to another link.');
      uploads.push(row);
    }
    const token = makeToken(),
      hash = await tokenHash(token),
      expiresAt = now + data.expiresHours * 3600000;
    const insert = db
      .prepare(
        'INSERT INTO review_shares (token_hash,title,caption,project_json,created_at,expires_at,revoked) SELECT ?,?,?,?,?,?,0 WHERE (SELECT COUNT(*) FROM review_shares WHERE revoked=0 AND expires_at>?)<20',
      )
      .bind(hash, data.title, data.caption, JSON.stringify(data.project), now, expiresAt, now);
    const statements = [
      insert,
      ...uploads.map((upload) =>
        db
          .prepare(
            'UPDATE review_uploads SET share_hash=? WHERE id=? AND share_hash IS NULL AND EXISTS (SELECT 1 FROM review_shares WHERE token_hash=?)',
          )
          .bind(hash, upload.id, hash),
      ),
    ];
    const results = await db.batch(statements);
    if (!results[0]?.meta?.changes)
      fail(409, 'Maximum 20 active review links. Revoke a link first.');
    // Conditional attachment prevents a race from exposing files assigned to another capability.
    if (results.slice(1).some((result) => result.meta?.changes !== 1)) {
      await db
        .prepare(
          `UPDATE review_shares SET revoked=1,title='',caption='',project_json='{}' WHERE token_hash=?`,
        )
        .bind(hash)
        .run();
      fail(409, 'A review file was attached to another link. Try again with a new upload.');
    }
    return json(
      {
        token,
        url: url.origin + '/review.html#' + encodeURIComponent(token),
        apiURL: url.origin + PREFIX + 'share/' + token,
        expiresAt,
      },
      201,
    );
  }
  const upload = path.match(/^upload\/([^/]+)$/);
  if (upload && request.method === 'PUT') {
    await authorize(request, env, origin);
    const id = upload[1];
    if (!UUID.test(id)) fail(400, 'Use a random UUID v4 for the upload.');
    const mime = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!MIMES.has(mime)) fail(415, 'Only PNG, JPEG, MP4 and WebM review exports are supported.');
    const existing = await db.prepare('SELECT * FROM review_uploads WHERE id=?').bind(id).first();
    if (existing) fail(409, 'Upload id already exists.');
    await cleanupReview(env, now);
    const count = await db.prepare('SELECT COUNT(*) AS count FROM review_uploads').first();
    if ((count?.count || 0) >= 100)
      fail(409, 'Review media limit reached. Revoke old links first.');
    const bytes = await readBytes(request, MAX_UPLOAD);
    if (!verifyType(bytes, mime)) fail(415, 'File content does not match its media type.');
    const key = 'reviews/uploads/' + id;
    // D1 reserves the id before object writes, so an existing shared file cannot be overwritten.
    try {
      await db
        .prepare(
          'INSERT INTO review_uploads (id,object_key,mime,size,created_at,share_hash) VALUES (?,?,?,?,?,NULL)',
        )
        .bind(id, key, mime, bytes.byteLength, now)
        .run();
    } catch {
      fail(409, 'Upload id already exists.');
    }
    try {
      await env.REVIEW_MEDIA.put(key, bytes, {
        httpMetadata: { contentType: mime },
        customMetadata: { createdAt: String(now), purpose: 'private-review' },
      });
    } catch (error) {
      await db
        .prepare('DELETE FROM review_uploads WHERE id=? AND share_hash IS NULL')
        .bind(id)
        .run();
      throw error;
    }
    return json({ id, key, mime, size: bytes.byteLength }, 201);
  }
  const shared = path.match(/^share\/([^/]+)(?:\/(comments|media)(?:\/([^/]+))?)?$/);
  if (!shared) fail(404, 'Review route not found.');
  const token = shared[1],
    subroute = shared[2],
    mediaId = shared[3];
  if (request.method === 'DELETE' && !subroute) {
    await authorize(request, env, origin);
    if (!TOKEN.test(token)) fail(404, 'Review link not found.');
    const hash = await tokenHash(token),
      row = await db.prepare('SELECT * FROM review_shares WHERE token_hash=?').bind(hash).first();
    if (!row) fail(404, 'Review link not found.');
    await db
      .prepare(
        `UPDATE review_shares SET revoked=1,title='',caption='',project_json='{}' WHERE token_hash=?`,
      )
      .bind(hash)
      .run();
    const mediaCleanupPending = await cleanMedia(env, hash);
    return json({ revoked: true, mediaCleanupPending });
  }
  const { share, hash } = await getShare(db, token, now);
  if (!subroute && request.method === 'GET') {
    const uploads = await all(
      db
        .prepare(
          'SELECT id,mime,size FROM review_uploads WHERE share_hash=? ORDER BY created_at LIMIT 5',
        )
        .bind(hash),
    );
    const comments = await all(
      db
        .prepare(
          'SELECT id,author,text,time,created_at FROM review_comments WHERE share_hash=? ORDER BY created_at DESC LIMIT 60',
        )
        .bind(hash),
    );
    return json({
      title: share.title,
      caption: share.caption,
      project: JSON.parse(share.project_json),
      expiresAt: share.expires_at,
      media: uploads.map((row) => ({
        ...row,
        url: url.origin + PREFIX + 'share/' + token + '/media/' + row.id,
      })),
      comments: comments.reverse().map((row) => ({
        id: row.id,
        author: row.author,
        text: row.text,
        time: row.time,
        createdAt: row.created_at,
      })),
    });
  }
  if (subroute === 'media' && mediaId && ['GET', 'HEAD'].includes(request.method)) {
    if (!UUID.test(mediaId)) fail(404, 'Review file not found.');
    const row = await db
      .prepare('SELECT * FROM review_uploads WHERE id=? AND share_hash=?')
      .bind(mediaId, hash)
      .first();
    if (!row) fail(404, 'Review file not found.');
    let range = null;
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      const parts = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
      if (!parts || (!parts[1] && !parts[2])) fail(416, 'Invalid byte range.');
      const start = parts[1] ? Number(parts[1]) : Math.max(0, row.size - Number(parts[2])),
        end = parts[1]
          ? parts[2]
            ? Math.min(row.size - 1, Number(parts[2]))
            : row.size - 1
          : row.size - 1;
      if (start >= row.size || end < start) fail(416, 'Invalid byte range.');
      range = { offset: start, length: end - start + 1 };
    }
    const object = await env.REVIEW_MEDIA.get(row.object_key, range ? { range } : undefined);
    if (!object) fail(404, 'Review file not found.');
    const extension =
      row.mime === 'image/png'
        ? 'png'
        : row.mime === 'image/jpeg'
          ? 'jpg'
          : row.mime === 'video/mp4'
            ? 'mp4'
            : 'webm';
    return new Response(request.method === 'HEAD' ? null : object.body, {
      status: range ? 206 : 200,
      headers: {
        ...(range
          ? {
              'Content-Range': `bytes ${range.offset}-${range.offset + range.length - 1}/${row.size}`,
            }
          : {}),
        'Accept-Ranges': 'bytes',
        'Content-Type': row.mime,
        'Content-Length': String(range ? range.length : row.size),
        'Content-Disposition': `inline; filename="review-${mediaId}.${extension}"`,
        'Cache-Control': 'private,no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  }
  if (subroute === 'comments' && request.method === 'POST') {
    const data = await readJSON(request, 8192),
      author = text(data.author || 'Visitante', 80),
      comment = text(data.text, 2000),
      time = Number(data.time ?? 0);
    if (!comment || !Number.isFinite(time) || time < 0 || time > 120)
      fail(400, 'Enter a comment and a time between 0 and 120 seconds.');
    const id = crypto.randomUUID(),
      day = Math.floor(now / 86400000) * 86400000;
    const result = await db
      .prepare(
        'INSERT INTO review_comments (id,share_hash,author,text,time,created_at) SELECT ?,?,?,?,?,? FROM review_shares WHERE token_hash=? AND revoked=0 AND expires_at>? AND (SELECT COUNT(*) FROM review_comments WHERE share_hash=? AND created_at>=?)<20',
      )
      .bind(id, hash, author, comment, time, now, hash, now, hash, day)
      .run();
    if (!result.meta?.changes)
      fail(429, 'This link reached its daily limit of 20 comments or is no longer active.');
    return json({ id, author, text: comment, time, createdAt: now }, 201);
  }
  fail(405, 'Method not allowed.');
}
export async function handleReview(request, env) {
  let origin;
  try {
    origin = originFor(request, env);
    if (!new URL(request.url).pathname.startsWith(PREFIX))
      return json({ error: 'Review route not found.' }, 404);
    if (request.method === 'OPTIONS')
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization,Content-Type',
          'Access-Control-Max-Age': '600',
          Vary: 'Origin',
        },
      });
    const response = await route(request, env, origin),
      headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    const response = json(
      { error: error.status ? error.message : 'Review service could not complete the request.' },
      error.status || 500,
    );
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Vary', 'Origin');
    }
    return response;
  }
}
export { MAX_UPLOAD };
