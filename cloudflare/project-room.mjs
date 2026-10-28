import { membership, updateProject } from './workspace.mjs';
import { json } from './accounts.mjs';
export function applyPatches(document, patches) {
  if (!Array.isArray(patches) || patches.length > 100) throw Error('Maximum 100 changes');
  const next = structuredClone(document);
  for (const patch of patches) {
    if (
      !Array.isArray(patch.path) ||
      !patch.path.length ||
      patch.path.length > 8 ||
      patch.path.some(
        (k) =>
          typeof k !== 'string' ||
          ['__proto__', 'constructor', 'prototype', 'id', 'created'].includes(k),
      )
    )
      throw Error('Invalid change path');
    let obj = next;
    for (const key of patch.path.slice(0, -1)) {
      obj = Array.isArray(obj) ? obj.find((x) => x.id === key) : obj?.[key];
      if (!obj || typeof obj !== 'object') throw Error('Changed structure; resolve conflict');
    }
    const key = patch.path.at(-1);
    if (Array.isArray(obj)) throw Error('Replace arrays through their parent');
    if (JSON.stringify(obj[key]) !== JSON.stringify(patch.before))
      throw Error('Concurrent change: ' + patch.path.join('.'));
    if (patch.remove) delete obj[key];
    else obj[key] = structuredClone(patch.value);
  }
  return next;
}
export class ProjectRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/kick') {
      const data = await request.json();
      for (const ws of this.ctx.getWebSockets()) {
        const a = ws.deserializeAttachment();
        if (a.userId === data.userId) ws.close(4003, 'Access revoked');
      }
      return json({ ok: true });
    }
    const userId = request.headers.get('X-Room-User'),
      projectId = request.headers.get('X-Room-Project'),
      sessionHash = request.headers.get('X-Room-Session');
    if (
      !userId ||
      !projectId ||
      !sessionHash ||
      request.headers.get('Upgrade')?.toLowerCase() !== 'websocket'
    )
      return json({ error: 'Unauthorized' }, 401);
    const pair = new WebSocketPair(),
      client = pair[0],
      server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId, projectId, sessionHash, minute: 0, messages: 0 });
    const row = await membership(this.env, projectId, userId);
    server.send(
      JSON.stringify({
        type: 'snapshot',
        revision: row.revision,
        document: JSON.parse(row.document),
      }),
    );
    await this.broadcast({ type: 'presence', count: this.ctx.getWebSockets().length });
    return new Response(null, { status: 101, webSocket: client });
  }
  async broadcast(data) {
    const text = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets())
      try {
        const a = ws.deserializeAttachment();
        const valid = await this.env.LIBRARY_DB.prepare(
          'SELECT s.hash FROM studio_sessions s JOIN cloud_members m ON m.user_id=s.user_id WHERE s.hash=? AND s.expires>? AND m.project_id=?',
        )
          .bind(a.sessionHash, Date.now(), a.projectId)
          .first();
        if (!valid) {
          ws.close(4003, 'Access revoked');
          continue;
        }
        ws.send(text);
      } catch {}
  }
  async webSocketMessage(ws, message) {
    const a = ws.deserializeAttachment();
    try {
      if (typeof message !== 'string' || message.length > 200000) throw Error('Message too large');
      const minute = Math.floor(Date.now() / 60000);
      a.messages = a.minute === minute ? a.messages + 1 : 1;
      a.minute = minute;
      if (a.messages > 90) throw Error('Too many changes');
      ws.serializeAttachment(a);
      const session = await this.env.LIBRARY_DB.prepare(
        'SELECT user_id FROM studio_sessions WHERE hash=? AND user_id=? AND expires>?',
      )
        .bind(a.sessionHash, a.userId, Date.now())
        .first();
      if (!session) {
        ws.close(4001, 'Session expired');
        return;
      }
      const data = JSON.parse(message),
        row = await membership(this.env, a.projectId, a.userId, data.type === 'patch');
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      if (data.type !== 'patch') throw Error('Unsupported message');
      const next = applyPatches(JSON.parse(row.document), data.patches);
      const result = await updateProject(this.env, row, next, a.userId);
      await this.broadcast({
        type: 'update',
        id: data.id,
        author: a.userId,
        revision: result.revision,
        document: result.document,
      });
    } catch (error) {
      try {
        ws.send(JSON.stringify({ type: 'conflict', message: error.message }));
        const row = await membership(this.env, a.projectId, a.userId);
        ws.send(
          JSON.stringify({
            type: 'snapshot',
            revision: row.revision,
            document: JSON.parse(row.document),
          }),
        );
      } catch {
        ws.close(4003, 'Access revoked');
      }
    }
  }
  async webSocketClose(ws) {
    try {
      ws.close();
    } catch {}
    await this.broadcast({ type: 'presence', count: this.ctx.getWebSockets().length });
  }
  webSocketError(ws) {
    try {
      ws.close(1011, 'Connection failed');
    } catch {}
  }
}
