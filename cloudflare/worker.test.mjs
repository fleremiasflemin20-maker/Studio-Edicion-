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
