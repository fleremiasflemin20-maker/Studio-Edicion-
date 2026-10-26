import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { LumaState, encrypt, decrypt, equal } from './worker.mjs';
function fixture() {
  const map = new Map();
  let alarm;
  const store = {
    get: async (k) => map.get(k),
    put: async (k, v) => map.set(k, structuredClone(v)),
    delete: async (k) => map.delete(k),
    list: async ({ prefix }) => new Map([...map].filter(([k]) => k.startsWith(prefix))),
    getAlarm: async () => alarm,
    setAlarm: async (at) => (alarm = at),
    transaction: async (fn) => fn(store),
  };
  const env = {
    LUMA_SERVICE_TOKEN: 's'.repeat(40),
    LUMA_ENCRYPTION_KEY: '12'.repeat(32),
    LUMA_ORIGINS: 'https://allowed.test',
    MEDIA: {
      head: async (id) =>
        id === 'media/file' ? { size: 50, httpMetadata: { contentType: 'video/webm' } } : null,
      put: async () => {},
    },
  };
  return { state: new LumaState({ storage: store }, env), env, store, getAlarm: () => alarm };
}
test('Cloudflare secrets are encrypted and authenticated', () => {
  const secret = '12'.repeat(32),
    encoded = encrypt({ token: 'private' }, secret);
  assert.deepEqual(decrypt(encoded, secret), { token: 'private' });
  assert.throws(() => decrypt(encoded, '34'.repeat(32)));
  assert.ok(equal('abc', 'abc'));
  assert.ok(!equal('abc', 'x'));
});
test('Worker rejects unauthorized requests and origins', async () => {
  const { env } = fixture();
  const denied = await worker.fetch(new Request('https://service.test/api/status'), env);
  assert.equal(denied.status, 401);
  const evil = await worker.fetch(
    new Request('https://service.test/api/status', { headers: { Origin: 'https://evil.test' } }),
    env,
  );
  assert.equal(evil.status, 403);
});
test('Durable scheduling persists and deduplicates a publication', async () => {
  const { state, store, getAlarm } = fixture();
  await store.put('account:account', { id: 'account', name: 'Test', platform: 'youtube' });
  const data = {
    account: 'account',
    media: 'file',
    caption: 'Hola',
    at: new Date(Date.now() + 3600000).toISOString(),
  };
  const request = () =>
    new Request('https://service.test/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'one' },
      body: JSON.stringify(data),
    });
  const a = await (await state.fetch(request())).json(),
    b = await (await state.fetch(request())).json();
  assert.equal(a.id, b.id);
  assert.equal((await state.list('post:')).length, 1);
  assert.ok(getAlarm() > Date.now());
  assert.equal((await state.list('post:'))[0].privacy, 'private');
});
test('Render jobs store project payload separately from durable metadata', async () => {
  const { state, getAlarm } = fixture();
  const r = await state.fetch(
    new Request('https://service.test/api/renders', {
      method: 'POST',
      body: JSON.stringify({
        project: { name: 'Test', scenes: [{}] },
        media: [{ local: 'old', remote: 'file' }],
      }),
    }),
  );
  assert.equal(r.status, 202);
  const jobs = await state.list('render:');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].project, undefined);
  assert.ok(getAlarm());
});

test('Temporary files persist in bounded chunks without R2', async () => {
  const { DurableFiles } = await import('./files.mjs');
  const f = fixture(),
    files = new DurableFiles(f.store),
    bytes = new Uint8Array(180000);
  bytes.fill(77);
  await files.put('media/test', bytes, { httpMetadata: { contentType: 'video/webm' } });
  const metadata = await files.head('media/test');
  assert.equal(metadata.size, bytes.length);
  assert.equal(metadata.count, 3);
  const stored = await files.get('media/test');
  const restored = new Uint8Array(await new Response(stored.body).arrayBuffer());
  assert.deepEqual(restored, bytes);
  assert.equal((await files.usage()).usedBytes, bytes.length);
  await assert.rejects(() => files.put('large', new Uint8Array(8 * 1024 * 1024 + 1)), /8 MB/);
  await files.clear();
  assert.equal((await files.usage()).usedBytes, 0);
});
test('Service supports temporary uploads without any R2 binding', async () => {
  const f = fixture();
  delete f.env.MEDIA;
  const state = new LumaState({ storage: f.store }, f.env),
    request = new Request('https://service.test/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'video/webm', 'Content-Length': '50' },
      body: new Uint8Array(50),
    });
  const result = await (await state.fetch(request)).json();
  assert.ok(result.id);
  const response = await state.fetch(new Request('https://service.test/api/media/' + result.id));
  assert.equal((await response.arrayBuffer()).byteLength, 50);
});

test('Private R2 wrapper enforces per-file and total limits', async () => {
  const { R2Files } = await import('./files.mjs'),
    f = fixture(),
    objects = new Map(),
    bucket = {
      put: async (k, v) => {
        objects.set(k, v);
        return { size: v.byteLength };
      },
      delete: async (k) => objects.delete(k),
      head: async (k) => (objects.has(k) ? { size: objects.get(k).byteLength } : null),
      get: async (k) => objects.get(k),
    };
  const files = new R2Files(bucket, f.store);
  await files.put('media/one', new Uint8Array(100));
  assert.equal((await files.usage()).usedBytes, 100);
  await assert.rejects(
    () => files.put('large', new Uint8Array(1), { size: 65 * 1024 * 1024 }),
    /límite/,
  );
  await f.store.put('r2-meta:quota', { key: 'quota', size: 512 * 1024 * 1024 });
  await assert.rejects(() => files.put('more', new Uint8Array(1)), /límite/);
  await files.clear();
  assert.equal((await files.usage()).usedBytes, 0);
});

test('Public studio opens without exposing the private API', async () => {
  const { env } = fixture();
  env.ASSETS = {
    fetch: async () =>
      new Response('<title>Luma Studio</title>', { headers: { 'Content-Type': 'text/html' } }),
  };
  const studio = await worker.fetch(new Request('https://service.test/'), env);
  assert.equal(studio.status, 200);
  assert.match(await studio.text(), /Luma Studio/);
  const api = await worker.fetch(new Request('https://service.test/api/status'), env);
  assert.equal(api.status, 401);
  const renderer = await worker.fetch(new Request('https://service.test/studio/index.html'), env);
  assert.equal(renderer.status, 401);
});
