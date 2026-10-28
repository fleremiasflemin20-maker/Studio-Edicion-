import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  handleReview,
  normalizeReview,
  tokenHash,
  MAX_UPLOAD,
  cleanupReview,
} from './review-service.mjs';
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('./review-schema.sql', import.meta.url), 'utf8'));
  const prepare = (sql) => {
    let args = [];
    const statement = sqlite.prepare(sql);
    return {
      bind(...values) {
        args = values;
        return this;
      },
      async first() {
        return statement.get(...args) || null;
      },
      async all() {
        return { results: statement.all(...args) };
      },
      async run() {
        const result = statement.run(...args);
        return { meta: { changes: Number(result.changes) } };
      },
    };
  };
  const DB = {
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const objects = new Map(),
    calls = [];
  const env = {
    LIBRARY_DB: DB,
    REVIEW_ORIGINS: 'https://studio.test',
    PRIVATE_SERVICE: {
      async fetch(request) {
        calls.push(request);
        return new Response('{}', {
          status: request.headers.get('Authorization') === 'Bearer owner-secret-token' ? 200 : 401,
        });
      },
    },
    REVIEW_MEDIA: {
      async put(key, bytes, options) {
        objects.set(key, { bytes: new Uint8Array(bytes), options });
      },
      async head(key) {
        return objects.has(key) ? { size: objects.get(key).bytes.byteLength } : null;
      },
      async get(key, options) {
        const object = objects.get(key);
        if (!object) return null;
        const range = options?.range;
        return {
          body: range
            ? object.bytes.slice(range.offset, range.offset + range.length)
            : object.bytes,
        };
      },
      async delete(key) {
        objects.delete(key);
      },
    },
  };
  const request = (path, method = 'GET', data, auth = false, headers = {}) =>
    new Request('https://studio.test/review/v1/' + path, {
      method,
      headers: {
        Origin: 'https://studio.test',
        ...(auth ? { Authorization: 'Bearer owner-secret-token' } : {}),
        ...(data && !(data instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(data !== undefined
        ? { body: data instanceof Uint8Array ? data : JSON.stringify(data) }
        : {}),
    });
  const call = (path, method = 'GET', data, auth = false, headers = {}) =>
    handleReview(request(path, method, data, auth, headers), env);
  return { env, objects, call, request, sqlite, calls };
}
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
async function upload(f) {
  const id = crypto.randomUUID(),
    response = await f.call('upload/' + id, 'PUT', PNG, true, { 'Content-Type': 'image/png' });
  assert.equal(response.status, 201);
  return response.json();
}
async function create(f, assetKeys = []) {
  const response = await f.call(
    'create',
    'POST',
    {
      title: 'Review',
      caption: 'My caption',
      project: { name: 'Test', format: '9:16', sceneCount: 2, duration: 8, secret: 'never share' },
      assetKeys,
    },
    true,
  );
  assert.equal(response.status, 201);
  return response.json();
}
test('review authoring refuses missing/invalid owner credentials and unapproved origins', async () => {
  const f = fixture();
  assert.equal((await f.call('create', 'POST', { title: 'Test' })).status, 401);
  assert.equal(
    (
      await handleReview(
        f.request('create', 'POST', { title: 'Test' }, false, {
          Authorization: 'Bearer invalid-token',
        }),
        f.env,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await handleReview(
        f.request('create', 'POST', { title: 'Test' }, true, { Origin: 'https://evil.test' }),
        f.env,
      )
    ).status,
    403,
  );
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS count FROM review_shares').get().count, 0);
  const made = await create(f);
  assert.match(made.token, /^[A-Za-z0-9_-]{32}$/);
  assert.ok(f.calls.every((request) => new URL(request.url).pathname === '/api/status'));
  assert.ok(
    !JSON.stringify(f.sqlite.prepare('SELECT * FROM review_shares').get()).includes(made.token),
  );
});
test('review links expose only selected exports and safe metadata, support ranges and cannot enumerate uploads', async () => {
  const f = fixture(),
    a = await upload(f),
    b = await upload(f),
    made = await create(f, [a.key]),
    response = await f.call('share/' + made.token),
    shared = await response.json();
  assert.equal(shared.media.length, 1);
  assert.equal(shared.project.secret, undefined);
  assert.equal(shared.media[0].key, undefined);
  assert.equal((await f.call('share/' + made.token + '/media/' + b.id)).status, 404);
  const media = await f.call('share/' + made.token + '/media/' + a.id);
  assert.equal(media.status, 200);
  assert.deepEqual(new Uint8Array(await media.arrayBuffer()), PNG);
  assert.equal(media.headers.get('Cache-Control'), 'private,no-store');
  const partial = await f.call('share/' + made.token + '/media/' + a.id, 'GET', undefined, false, {
    Range: 'bytes=0-3',
  });
  assert.equal(partial.status, 206);
  assert.deepEqual([...new Uint8Array(await partial.arrayBuffer())], [137, 80, 78, 71]);
  assert.equal(partial.headers.get('Content-Range'), 'bytes 0-3/12');
  assert.equal(
    (
      await f.call('share/' + made.token + '/media/' + a.id, 'GET', undefined, false, {
        Range: 'bytes=999-',
      })
    ).status,
    416,
  );
  assert.equal((await f.call('share/not-a-capability')).status, 404);
  assert.equal(
    (await f.call('share/' + made.token + '/media/' + a.id, 'PUT', PNG, true)).status,
    405,
  );
});
test('expired and revoked capabilities deny media and comments even if R2 cleanup fails', async () => {
  const f = fixture(),
    a = await upload(f),
    made = await create(f, [a.key]);
  assert.equal((await f.call('share/' + made.token, 'DELETE')).status, 401);
  f.env.REVIEW_MEDIA.delete = async () => {
    throw Error('storage unavailable');
  };
  const revoked = await f.call('share/' + made.token, 'DELETE', undefined, true);
  assert.equal(revoked.status, 200);
  assert.equal((await revoked.json()).mediaCleanupPending, true);
  assert.equal(f.objects.size, 1);
  assert.equal(f.sqlite.prepare('SELECT title FROM review_shares').get().title, '');
  for (const path of ['share/' + made.token, 'share/' + made.token + '/media/' + a.id])
    assert.equal((await f.call(path)).status, 410);
  assert.equal(
    (await f.call('share/' + made.token + '/comments', 'POST', { text: 'Too late' })).status,
    410,
  );
  const next = await create(f);
  f.sqlite
    .prepare('UPDATE review_shares SET expires_at=? WHERE token_hash=?')
    .run(Date.now() - 1, await tokenHash(next.token));
  assert.equal((await f.call('share/' + next.token)).status, 410);
});
test('uploads enforce size/type, reserve immutable ids, and cannot be attached twice', async () => {
  const f = fixture();
  assert.equal(
    (
      await f.call('upload/' + crypto.randomUUID(), 'PUT', PNG, true, {
        'Content-Type': 'image/svg+xml',
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await f.call('upload/' + crypto.randomUUID(), 'PUT', PNG, true, {
        'Content-Type': 'image/png',
        'Content-Length': String(MAX_UPLOAD + 1),
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await f.call('upload/' + crypto.randomUUID(), 'PUT', new Uint8Array([0, 1, 2]), true, {
        'Content-Type': 'image/png',
      })
    ).status,
    415,
  );
  const asset = await upload(f);
  assert.equal(
    (await f.call('upload/' + asset.id, 'PUT', PNG, true, { 'Content-Type': 'image/png' })).status,
    409,
  );
  await create(f, [asset.key]);
  assert.equal(
    (await f.call('create', 'POST', { title: 'Second', assetKeys: [asset.key] }, true)).status,
    400,
  );
  assert.throws(() => normalizeReview({ title: 'bad', assetKeys: ['../../private-file'] }));
});
test('comment capability has a per-day limit and bounds authors, text and timestamps', async () => {
  const f = fixture(),
    made = await create(f);
  for (let i = 0; i < 20; i++) {
    const response = await f.call('share/' + made.token + '/comments', 'POST', {
      author: 'a'.repeat(100),
      text: 'Comment ' + i,
      time: 2,
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).author.length, 80);
  }
  assert.equal(
    (await f.call('share/' + made.token + '/comments', 'POST', { text: 'One too many' })).status,
    429,
  );
  assert.equal(
    (await f.call('share/' + made.token + '/comments', 'POST', { text: 'bad', time: 999 })).status,
    400,
  );
  const shared = await (await f.call('share/' + made.token)).json();
  assert.equal(shared.comments.length, 20);
});
test('twenty-link quota and maximum 72-hour expiry are enforced and cleanup removes expired exports', async () => {
  const f = fixture(),
    asset = await upload(f),
    first = await create(f, [asset.key]);
  assert.ok(first.expiresAt - Date.now() <= 72 * 3600000);
  for (let i = 1; i < 20; i++) await create(f);
  assert.equal((await f.call('create', 'POST', { title: 'Too many' }, true)).status, 409);
  f.sqlite
    .prepare('UPDATE review_shares SET expires_at=? WHERE token_hash=?')
    .run(Date.now() - 1, await tokenHash(first.token));
  await cleanupReview(f.env);
  assert.equal(f.objects.has(asset.key), false);
  assert.equal(
    (await f.call('create', 'POST', { title: 'Space again', expiresHours: 9999 }, true)).status,
    201,
  );
});
