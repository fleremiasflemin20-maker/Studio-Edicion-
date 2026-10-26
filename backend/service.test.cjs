const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { createService, seal, unseal, safeEqual } = require('./service.cjs');
test('Credentials are encrypted and tampering is rejected', () => {
  const key = crypto.randomBytes(32),
    data = seal({ refresh_token: 'private-value' }, key);
  assert.ok(!data.includes('private-value'));
  assert.deepEqual(unseal(data, key), { refresh_token: 'private-value' });
  assert.throws(() => unseal(data, crypto.randomBytes(32)));
  assert.ok(safeEqual('abc', 'abc'));
  assert.ok(!safeEqual('a', 'abc'));
});
test('Service authenticates, restricts origins, persists jobs and deduplicates posts', async (t) => {
  const dir = fs.mkdtempSync(path.join(__dirname, '.test-data-')),
    env = {
      LUMA_SERVICE_TOKEN: 'test-'.repeat(8),
      LUMA_ENCRYPTION_KEY: '12'.repeat(32),
      LUMA_ORIGINS: 'https://allowed.test',
    },
    s = createService({ env, dataDir: dir, noScheduler: true });
  await new Promise((r) => s.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + s.server.address().port,
    headers = { Authorization: 'Bearer ' + env.LUMA_SERVICE_TOKEN };
  t.after(async () => {
    await new Promise((r) => s.server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  assert.equal((await fetch(base + '/api/status')).status, 401);
  assert.equal(
    (await fetch(base + '/api/status', { headers: { ...headers, Origin: 'https://evil.test' } }))
      .status,
    403,
  );
  const status = await (await fetch(base + '/api/status', { headers })).json();
  assert.deepEqual(status.accounts, []);
  assert.deepEqual(status.providers, []);
  const media = await (
    await fetch(base + '/api/media', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'video/webm' },
      body: Buffer.alloc(50),
    })
  ).json();
  assert.ok(media.id);
  s.db.accounts.push({ id: 'account', platform: 'youtube', name: 'Test', secret: s.seal({}) });
  const post = {
    account: 'account',
    media: media.id,
    caption: 'Hello',
    at: new Date(Date.now() + 3600000).toISOString(),
  };
  const create = () =>
    fetch(base + '/api/posts', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': 'same-key' },
      body: JSON.stringify(post),
    }).then((r) => r.json());
  const a = await create(),
    b = await create();
  assert.equal(a.id, b.id);
  assert.equal(s.db.posts.length, 1);
  assert.equal(s.db.posts[0].privacy, 'private');
  assert.equal(fs.existsSync(path.join(dir, 'state.json')), true);
  const render = await (
    await fetch(base + '/api/renders', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: { name: 'test' },
        media: [{ local: 'original', remote: media.id }],
      }),
    })
  ).json();
  assert.equal(render.status, 'Pendiente');
  assert.equal((await fetch(base + '/studio/../service.cjs', { headers })).status, 404);
});
test('Service refuses missing deployment secrets', () =>
  assert.throws(() => createService({ env: {} }), /Configura/));
