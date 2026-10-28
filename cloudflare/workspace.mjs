import {
  authenticate,
  body,
  cors,
  fail,
  hash,
  json,
  origin,
  randomToken,
  rate,
  uuid,
} from './accounts.mjs';
const ID = /^[0-9a-f-]{36}$/i,
  MAX_DOC = 1400000,
  MAX_FILE = 20 * 1024 * 1024;
export function validateDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Invalid project');
  const text = JSON.stringify(value);
  if (text.length > MAX_DOC) fail(413, 'Project exceeds 1.4 MB');
  if (
    typeof value.name !== 'string' ||
    value.name.length > 160 ||
    !['9:16', '1:1', '4:5', '16:9'].includes(value.format) ||
    !Array.isArray(value.scenes) ||
    !value.scenes.length ||
    value.scenes.length > 24
  )
    fail(400, 'Invalid project structure');
  const seen = new Set();
  for (const s of value.scenes) {
    if (!ID.test(s.id) || seen.has(s.id) || !Array.isArray(s.layers) || s.layers.length > 40)
      fail(400, 'Invalid or duplicate scene');
    seen.add(s.id);
    const layers = new Set();
    for (const l of s.layers) {
      if (!ID.test(l.id) || layers.has(l.id)) fail(400, 'Invalid or duplicate layer');
      layers.add(l.id);
    }
  }
  if (/"(?:__proto__|constructor|prototype)"\s*:/.test(text)) fail(400, 'Unsafe property');
  return JSON.parse(text);
}
export function references(doc) {
  const result = new Set();
  const walk = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (['asset', 'audio', 'transcriptAsset'].includes(key) && typeof item === 'string') {
        if (!ID.test(item)) fail(400, 'Invalid media reference');
        result.add(item);
      } else if (typeof item === 'object') walk(item);
    }
  };
  walk(doc);
  if (result.size > 100) fail(400, 'Too many media files');
  return [...result];
}
export async function membership(env, id, userId, write = false) {
  const row = await env.LIBRARY_DB.prepare(
    'SELECT p.*,m.role FROM cloud_projects p JOIN cloud_members m ON m.project_id=p.id WHERE p.id=? AND m.user_id=?',
  )
    .bind(id, userId)
    .first();
  if (!row) fail(404, 'Project not found');
  if (write && !['owner', 'editor'].includes(row.role)) fail(403, 'Read-only project');
  return row;
}
export async function checkAssets(env, ids, userId, projectId) {
  for (const id of ids) {
    const row = await env.LIBRARY_DB.prepare(
      'SELECT a.id FROM cloud_assets a WHERE a.id=? AND a.state=? AND (a.owner_id=? OR EXISTS(SELECT 1 FROM cloud_project_assets pa JOIN cloud_members m ON m.project_id=pa.project_id WHERE pa.asset_id=a.id AND pa.project_id=? AND m.user_id=?))',
    )
      .bind(id, 'ready', userId, projectId || '', userId)
      .first();
    if (!row) fail(403, 'Media is missing or inaccessible');
  }
}
async function linkAssets(db, id, ids) {
  await db.batch([
    db.prepare('DELETE FROM cloud_project_assets WHERE project_id=?').bind(id),
    ...ids.map((a) =>
      db.prepare('INSERT INTO cloud_project_assets(project_id,asset_id) VALUES(?,?)').bind(id, a),
    ),
  ]);
}
export async function updateProject(env, row, doc, userId) {
  const next = validateDocument(doc);
  next.id = row.id;
  const ids = references(next),
    stamp = uuid(),
    now = Date.now();
  await checkAssets(env, ids, userId, row.id);
  const ops = [
    env.LIBRARY_DB.prepare(
      'UPDATE cloud_projects SET document=?,name=?,revision=revision+1,updated=?,stamp=? WHERE id=? AND revision=?',
    ).bind(JSON.stringify(next), next.name, now, stamp, row.id, row.revision),
    env.LIBRARY_DB.prepare(
      'DELETE FROM cloud_project_assets WHERE project_id=? AND EXISTS(SELECT 1 FROM cloud_projects WHERE id=? AND stamp=?)',
    ).bind(row.id, row.id, stamp),
    ...ids.map((id) =>
      env.LIBRARY_DB.prepare(
        'INSERT INTO cloud_project_assets(project_id,asset_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM cloud_projects WHERE id=? AND stamp=?)',
      ).bind(row.id, id, row.id, stamp),
    ),
  ];
  const result = await env.LIBRARY_DB.batch(ops);
  if (!result[0].meta.changes) fail(409, 'Project changed. Review conflicts');
  return { revision: row.revision + 1, updated: now, document: next };
}

async function bytes(request) {
  const size = +request.headers.get('Content-Length');
  if (!size || size > MAX_FILE) fail(413, 'Upload requires length and must be at most 20 MB');
  const data = new Uint8Array(await request.arrayBuffer());
  if (data.length !== size) fail(400, 'Invalid upload length');
  return data;
}
function mimeType(bytes, type) {
  if (type === 'image/png') return bytes[0] === 137 && bytes[1] === 80;
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216;
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (type === 'audio/wav')
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WAVE'
    );
  if (type === 'video/webm' || type === 'audio/webm')
    return bytes[0] === 26 && bytes[1] === 69 && bytes[2] === 223 && bytes[3] === 163;
  if (type === 'video/mp4' || type === 'audio/mp4')
    return String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
  if (type === 'audio/mpeg')
    return (
      (bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51) ||
      (bytes[0] === 255 && (bytes[1] & 224) === 224)
    );
  return false;
}
export async function saveAsset(env, user, file, name, type) {
  const db = env.LIBRARY_DB;
  if (!env.USER_MEDIA) fail(503, 'Private storage unavailable');
  if (file.length > MAX_FILE || !mimeType(file, type))
    fail(415, 'Unsupported file signature or size');
  const now = Date.now(),
    id = uuid(),
    key = 'users/' + user.id + '/' + id;
  const reserve = await db
    .prepare(
      'INSERT INTO cloud_assets(id,owner_id,key,name,mime,size,created,state) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COALESCE(SUM(size),0) FROM cloud_assets WHERE owner_id=?) + ? <= 268435456 RETURNING id',
    )
    .bind(
      id,
      user.id,
      key,
      String(name).slice(0, 160),
      type,
      file.length,
      now,
      'reserved',
      user.id,
      file.length,
    )
    .first();
  if (!reserve) fail(413, 'Private storage quota is 256 MB per account');
  try {
    await env.USER_MEDIA.put(key, file, { httpMetadata: { contentType: type } });
    await db.prepare('UPDATE cloud_assets SET state=? WHERE id=?').bind('ready', id).run();
  } catch (error) {
    await db.prepare('DELETE FROM cloud_assets WHERE id=?').bind(id).run();
    throw error;
  }
  return { id, name: String(name).slice(0, 160), mime: type, size: file.length };
}
export async function handleWorkspace(request, env) {
  let allowed;
  try {
    allowed = origin(request, env);
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), allowed);
    const db = env.LIBRARY_DB,
      url = new URL(request.url),
      path = url.pathname;
    let user;
    const live = path.match(/^\/cloud\/v1\/projects\/([a-f0-9-]+)\/live$/i);
    if (live && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const ticket = String(url.searchParams.get('ticket') || '');
      if (!/^[\w-]{43}$/.test(ticket)) fail(401, 'Invalid connection ticket');
      const saved = await db
        .prepare(
          'DELETE FROM cloud_tickets WHERE hash=? AND project_id=? AND expires>? RETURNING *',
        )
        .bind(await hash(ticket), live[1], Date.now())
        .first();
      if (!saved) fail(401, 'Connection ticket expired');
      const member = await membership(env, live[1], saved.user_id);
      const session = await db
        .prepare('SELECT * FROM studio_sessions WHERE hash=? AND user_id=? AND expires>?')
        .bind(saved.session_hash, saved.user_id, Date.now())
        .first();
      if (!session) fail(401, 'Session expired');
      const headers = new Headers(request.headers);
      headers.delete('Authorization');
      headers.set('X-Room-User', saved.user_id);
      headers.set('X-Room-Project', live[1]);
      headers.set('X-Room-Session', saved.session_hash);
      return env.PROJECT_ROOMS.get(env.PROJECT_ROOMS.idFromName(live[1])).fetch(
        new Request('https://room.internal/connect', { headers }),
      );
    }
    user = await authenticate(request, env);
    await rate(db, 'api:' + user.id + ':' + Math.floor(Date.now() / 60000), 120);
    if (path === '/cloud/v1/projects' && request.method === 'GET') {
      const result = await db
        .prepare(
          'SELECT p.id,p.name,p.revision,p.updated,m.role,p.owner_id FROM cloud_projects p JOIN cloud_members m ON m.project_id=p.id WHERE m.user_id=? ORDER BY p.updated DESC LIMIT 100',
        )
        .bind(user.id)
        .all();
      return cors(json({ projects: result.results }), allowed);
    }
    if (path === '/cloud/v1/projects' && request.method === 'POST') {
      const data = await body(request, MAX_DOC + 10000),
        doc = validateDocument(data.document),
        id = uuid(),
        ids = references(doc);
      await checkAssets(env, ids, user.id, null);
      doc.id = id;
      const result = await db
        .prepare(
          'INSERT INTO cloud_projects(id,owner_id,name,document,revision,updated) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM cloud_projects WHERE owner_id=?)<30 RETURNING id',
        )
        .bind(id, user.id, doc.name, JSON.stringify(doc), 1, Date.now(), user.id)
        .first();
      if (!result) fail(413, 'Maximum 30 cloud projects per account');
      await db.batch([
        db
          .prepare('INSERT INTO cloud_members(project_id,user_id,role) VALUES(?,?,?)')
          .bind(id, user.id, 'owner'),
        ...ids.map((a) =>
          db
            .prepare('INSERT INTO cloud_project_assets(project_id,asset_id) VALUES(?,?)')
            .bind(id, a),
        ),
      ]);
      return cors(json({ id, revision: 1, document: doc }, 201), allowed);
    }
    if (path === '/cloud/v1/assets' && request.method === 'POST') {
      const type = request.headers.get('Content-Type')?.split(';')[0],
        file = await bytes(request),
        name = decodeURIComponent(request.headers.get('X-Filename') || 'Resource');
      return cors(json(await saveAsset(env, user, file, name, type), 201), allowed);
    }
    const asset = path.match(/^\/cloud\/v1\/assets\/([a-f0-9-]+)$/i);
    if (asset && request.method === 'GET') {
      const row = await db
        .prepare(
          'SELECT a.* FROM cloud_assets a WHERE a.id=? AND a.state=? AND (a.owner_id=? OR EXISTS(SELECT 1 FROM cloud_project_assets pa JOIN cloud_members m ON m.project_id=pa.project_id WHERE pa.asset_id=a.id AND m.user_id=?))',
        )
        .bind(asset[1], 'ready', user.id, user.id)
        .first();
      if (!row) fail(404, 'File not found');
      const file = await env.USER_MEDIA.get(row.key);
      if (!file) fail(404, 'File unavailable');
      return cors(
        new Response(file.body, {
          headers: {
            'Content-Type': row.mime,
            'Content-Length': String(row.size),
            'Cache-Control': 'private,no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        }),
        allowed,
      );
    }
    const match = path.match(
      /^\/cloud\/v1\/projects\/([a-f0-9-]+)(?:\/(members|invite|ticket))?$/i,
    );
    if (match) {
      const id = match[1],
        action = match[2],
        row = await membership(env, id, user.id, request.method === 'PUT');
      if (!action && request.method === 'GET') {
        const files = await db
          .prepare(
            'SELECT a.id,a.name,a.mime,a.size FROM cloud_assets a JOIN cloud_project_assets pa ON pa.asset_id=a.id WHERE pa.project_id=? AND a.state=?',
          )
          .bind(id, 'ready')
          .all();
        return cors(
          json({
            id,
            role: row.role,
            ownerId: row.owner_id,
            document: JSON.parse(row.document),
            revision: row.revision,
            media: files.results,
          }),
          allowed,
        );
      }
      if (!action && request.method === 'PUT') {
        const data = await body(request, MAX_DOC + 10000);
        if (+data.revision !== row.revision)
          fail(409, 'Project changed; reload or resolve conflicts');
        const result = await updateProject(env, row, data.document, user.id);
        return cors(json({ id, ...result }), allowed);
      }
      if (action === 'ticket' && request.method === 'POST') {
        const token = randomToken();
        await db
          .prepare(
            'INSERT INTO cloud_tickets(hash,project_id,user_id,expires,session_hash) VALUES(?,?,?,?,?)',
          )
          .bind(await hash(token), id, user.id, Date.now() + 15000, user.sessionHash)
          .run();
        return cors(json({ ticket: token }), allowed);
      }
      if (action === 'members' && request.method === 'GET') {
        const members = await db
          .prepare(
            'SELECT u.id,u.name,m.role FROM cloud_members m JOIN studio_users u ON u.id=m.user_id WHERE m.project_id=?',
          )
          .bind(id)
          .all();
        return cors(json({ members: members.results }), allowed);
      }
      if (action === 'members' && request.method === 'DELETE') {
        if (row.role !== 'owner') fail(403, 'Owner only');
        const data = await body(request);
        if (data.userId === row.owner_id) fail(400, 'Cannot remove the owner');
        await db
          .prepare('DELETE FROM cloud_members WHERE project_id=? AND user_id=?')
          .bind(id, String(data.userId))
          .run();
        await env.PROJECT_ROOMS.get(env.PROJECT_ROOMS.idFromName(id)).fetch(
          new Request('https://room.internal/kick', {
            method: 'POST',
            body: JSON.stringify({ userId: String(data.userId) }),
          }),
        );
        return cors(json({ ok: true }), allowed);
      }
      if (action === 'invite' && request.method === 'POST') {
        if (row.role !== 'owner') fail(403, 'Owner only');
        const data = await body(request),
          token = randomToken(),
          role = data.role === 'viewer' ? 'viewer' : 'editor';
        await rate(db, 'invite:' + id + ':' + new Date().toISOString().slice(0, 10), 20);
        await db
          .prepare(
            'INSERT INTO cloud_invites(hash,project_id,role,expires,created) VALUES(?,?,?,?,?)',
          )
          .bind(await hash(token), id, role, Date.now() + 86400000, Date.now())
          .run();
        return cors(json({ token, expires: Date.now() + 86400000, role }), allowed);
      }
      if (action === 'invite' && request.method === 'DELETE') {
        if (row.role !== 'owner') fail(403, 'Owner only');
        await db.prepare('DELETE FROM cloud_invites WHERE project_id=?').bind(id).run();
        return cors(json({ ok: true }), allowed);
      }
    }
    if (path === '/cloud/v1/invitations/accept' && request.method === 'POST') {
      const data = await body(request),
        invite = await db
          .prepare('DELETE FROM cloud_invites WHERE hash=? AND expires>? RETURNING *')
          .bind(await hash(String(data.token)), Date.now())
          .first();
      if (!invite) fail(410, 'Invitation expired or used');
      await db
        .prepare(
          'INSERT INTO cloud_members(project_id,user_id,role) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM cloud_members WHERE project_id=?)<10 ON CONFLICT(project_id,user_id) DO NOTHING',
        )
        .bind(invite.project_id, user.id, invite.role, invite.project_id)
        .run();
      await membership(env, invite.project_id, user.id);
      return cors(json({ projectId: invite.project_id }), allowed);
    }
    return cors(json({ error: 'Route not found' }, 404), allowed);
  } catch (error) {
    return cors(
      json({ error: error.status ? error.message : 'Cloud operation failed' }, error.status || 500),
      allowed,
    );
  }
}
