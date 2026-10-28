import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCatalog, validateResource } from './catalog.mjs';
const origin = 'https://studio.example',
  token = 'Bearer owner-test-token';
const resource = {
  id: 'bg-paint-1',
  type: 'background',
  name: 'Pintura libre 1',
  nameEn: 'Free paint 1',
  tags: ['paint', 'pintura', 'dark'],
  license: 'Fleremahias Original Content License 1.0',
  version: 1,
  preview: 'library/bg-paint-1.svg',
};
function environment() {
  const calls = [];
  const row = {
    ...resource,
    name_en: resource.nameEn,
    metadata: JSON.stringify(resource),
    published: 1,
  };
  return {
    calls,
    PRIVATE_SERVICE: {
      async fetch(request) {
        calls.push({
          auth: request.headers.get('Authorization'),
          origin: request.headers.get('Origin'),
          url: request.url,
        });
        return new Response('{}', {
          status: request.headers.get('Authorization') === token ? 200 : 401,
        });
      },
    },
    LIBRARY_DB: {
      prepare(sql) {
        return {
          sql,
          args: [],
          bind(...args) {
            this.args = args;
            return this;
          },
          async all() {
            calls.push({ sql, args: this.args });
            return {
              results: sql.includes('GROUP BY') ? [{ type: 'background', total: 1 }] : [row],
            };
          },
          async first() {
            calls.push({ sql, args: this.args });
            return sql.includes('COUNT') ? { total: 1 } : row;
          },
          async run() {
            calls.push({ sql, args: this.args });
            return { success: true };
          },
        };
      },
    },
    ASSETS: {
      async fetch(request) {
        calls.push({ staticPath: new URL(request.url).pathname });
        return new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } });
      },
    },
  };
}
const req = (path, options = {}) => new Request(origin + path, options);
test('public catalog uses bound queries and serves only published metadata', async () => {
  const env = environment(),
    response = await handleCatalog(
      req('/catalog/v1/resources?type=background&q=paint%27%20OR%201&limit=1000&offset=3'),
      env,
    );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.limit, 100);
  assert.equal(body.offset, 3);
  assert.equal(body.items[0].id, resource.id);
  const query = env.calls.find((c) => c.sql?.includes('LIMIT'));
  assert.match(query.sql, /published = 1/);
  assert.ok(!query.sql.includes('paint'));
  assert.equal(query.args[0], 'background');
  assert.equal(query.args.at(-1), 3);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});
test('public curated asset never accesses private storage or arbitrary paths', async () => {
  const env = environment();
  env.MEDIA = {
    get() {
      throw Error('Private storage must not be accessed');
    },
  };
  const response = await handleCatalog(req('/catalog/v1/assets/bg-paint-1'), env);
  assert.equal(response.status, 200);
  assert.equal(env.calls.find((c) => c.staticPath).staticPath, '/library/bg-paint-1.svg');
  assert.equal(await response.text(), '<svg/>');
  assert.equal((await handleCatalog(req('/catalog/v1/assets/secret.png'), env)).status, 404);
  assert.equal(
    (await handleCatalog(req('/catalog/v1/resources', { method: 'POST' }), env)).status,
    405,
  );
});
test('missing database is explicit while fixed library assets can use static fallback', async () => {
  const env = environment();
  delete env.LIBRARY_DB;
  assert.equal((await handleCatalog(req('/catalog/v1/resources'), env)).status, 503);
  assert.equal((await handleCatalog(req('/catalog/v1/assets/bg-paint-1'), env)).status, 200);
});
test('administration requires owner authorization and rejects cross-origin requests before forwarding tokens', async () => {
  const env = environment();
  let response = await handleCatalog(req('/catalog/admin/status'), env);
  assert.equal(response.status, 401);
  assert.equal(env.calls.length, 0);
  response = await handleCatalog(
    req('/catalog/admin/status', {
      headers: { Authorization: token, Origin: 'https://attacker.example' },
    }),
    env,
  );
  assert.equal(response.status, 403);
  assert.equal(env.calls.length, 0);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  response = await handleCatalog(
    req('/catalog/admin/status', { headers: { Authorization: 'Bearer wrong-test-token' } }),
    env,
  );
  assert.equal(response.status, 401);
  response = await handleCatalog(
    req('/catalog/admin/status', { headers: { Authorization: token } }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(env.calls.find((c) => c.auth === token).origin, origin);
});
test('curated metadata cannot reference private files and writes use bound parameters', async () => {
  const env = environment();
  assert.throws(() => validateResource({ ...resource, preview: 'private/customer.png' }));
  assert.throws(() => validateResource({ ...resource, id: '../private' }));
  assert.throws(() => validateResource({ ...resource, type: 'executable' }));
  const response = await handleCatalog(
    req('/catalog/admin/catalog', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...resource, name: "Creator's paint" }),
    }),
    env,
  );
  assert.equal(response.status, 200);
  const write = env.calls.find((c) => c.sql?.startsWith('INSERT'));
  assert.ok(write);
  assert.ok(!write.sql.includes("Creator's"));
  assert.ok(write.args.includes("Creator's paint"));
});
test('owner upload accepts matching bounded PNG only into curated R2 namespace', async () => {
  const env = environment(),
    pngMeta = { ...resource, preview: 'library/bg-paint-1.png' },
    uploaded = [];
  env.LIBRARY_DB.prepare = () => ({
    bind() {
      return this;
    },
    async first() {
      return pngMeta;
    },
  });
  env.LIBRARY_MEDIA = {
    async put(key, value, options) {
      uploaded.push({ key, value, options });
    },
  };
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const v = new DataView(bytes.buffer);
  v.setUint32(16, 10);
  v.setUint32(20, 10);
  const response = await handleCatalog(
    req('/catalog/admin/assets/bg-paint-1', {
      method: 'PUT',
      headers: { Authorization: token, 'Content-Type': 'image/png' },
      body: bytes,
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(uploaded[0].key, 'catalog/bg-paint-1.png');
  assert.equal(uploaded[0].value.length, 24);
  const bad = await handleCatalog(
    req('/catalog/admin/assets/bg-paint-1', {
      method: 'PUT',
      headers: { Authorization: token, 'Content-Type': 'image/svg+xml' },
      body: '<svg onload="bad"/>',
    }),
    env,
  );
  assert.equal(bad.status, 415);
  const large = await handleCatalog(
    req('/catalog/admin/assets/bg-paint-1', {
      method: 'PUT',
      headers: {
        Authorization: token,
        'Content-Type': 'image/png',
        'Content-Length': String(6 * 1024 * 1024),
      },
      body: bytes,
    }),
    env,
  );
  assert.equal(large.status, 413);
  assert.equal(uploaded.length, 1);
});
test('unpublished or absent database rows cannot be fetched from curated R2', async () => {
  const env = environment();
  env.LIBRARY_DB.prepare = () => ({
    bind() {
      return this;
    },
    async first() {
      return null;
    },
  });
  let read = false;
  env.LIBRARY_MEDIA = {
    get() {
      read = true;
      return null;
    },
  };
  assert.equal((await handleCatalog(req('/catalog/v1/assets/bg-paint-1'), env)).status, 404);
  assert.equal(read, false);
});

test('curated audio upload verifies PCM format before storing', async () => {
  const env = environment(),
    audioMeta = { ...resource, id: 'sfx-air-1', type: 'sound', preview: 'library/sfx-air-1.wav' };
  env.LIBRARY_DB.prepare = () => ({
    bind() {
      return this;
    },
    async first() {
      return audioMeta;
    },
  });
  let writes = 0;
  env.LIBRARY_MEDIA = {
    async put() {
      writes++;
    },
  };
  const { createRequire } = await import('node:module'),
    require = createRequire(import.meta.url),
    L = require('../dist/library-assets.js');
  const bytes = L.sound('sfx-air-1');
  let response = await handleCatalog(
    req('/catalog/admin/assets/sfx-air-1', {
      method: 'PUT',
      headers: { Authorization: token, 'Content-Type': 'audio/wav' },
      body: bytes,
    }),
    env,
  );
  assert.equal(response.status, 200);
  const invalid = bytes.slice(0);
  new DataView(invalid).setUint16(20, 3, true);
  response = await handleCatalog(
    req('/catalog/admin/assets/sfx-air-1', {
      method: 'PUT',
      headers: { Authorization: token, 'Content-Type': 'audio/wav' },
      body: invalid,
    }),
    env,
  );
  assert.equal(response.status, 400);
  assert.equal(writes, 1);
});

test('owner batch validates the entire catalog before writes and uses groups of at most 50', async () => {
  const { createRequire } = await import('node:module'),
    require = createRequire(import.meta.url),
    L = require('../dist/library-assets.js');
  const env = environment(),
    groups = [];
  env.LIBRARY_DB.batch = async (statements) => {
    groups.push(statements.length);
    return Promise.all(statements.map((statement) => statement.run()));
  };
  const response = await handleCatalog(
    req('/catalog/admin/catalog', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: L.catalog }),
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).count, L.catalog.length);
  assert.ok(groups.every((length) => length <= 50));
  assert.equal(
    groups.reduce((a, b) => a + b, 0),
    L.catalog.length,
  );
  const writes = env.calls.filter((call) => call.sql?.startsWith('INSERT'));
  assert.equal(writes.length, L.catalog.length);
  const style = JSON.parse(writes.find((call) => call.args[0] === 'style-1').args[8]);
  assert.deepEqual(style.settings, L.catalog.find((item) => item.id === 'style-1').settings);
  assert.deepEqual(
    style.customFilter,
    L.catalog.find((item) => item.id === 'style-1').customFilter,
  );
  const recipe = JSON.parse(writes.find((call) => call.args[0] === 'recipe-podcast').args[8]);
  assert.equal(recipe.recipe.styleId, 'style-1');
  assert.ok(recipe.steps.length > 0);
  const title = JSON.parse(writes.find((call) => call.args[0] === 'title-1').args[8]);
  assert.equal(title.animation, 'rise');
  assert.equal(title.settings.style, 'editorial');
});
test('invalid final batch item, duplicate ids, and oversized batches never partially validate into writes', async () => {
  for (const items of [
    [resource, { ...resource, id: 'bad', preview: '../../private.png' }],
    [resource, resource],
    Array.from({ length: 301 }, (_, i) => ({
      ...resource,
      id: 'bg-' + i,
      preview: 'library/bg-' + i + '.svg',
    })),
  ]) {
    const env = environment();
    let batches = 0;
    env.LIBRARY_DB.batch = async () => {
      batches++;
      return [];
    };
    const response = await handleCatalog(
      req('/catalog/admin/catalog', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }),
      env,
    );
    assert.equal(response.status, 400);
    assert.equal(batches, 0);
    assert.equal(env.calls.filter((call) => call.sql?.startsWith('INSERT')).length, 0);
  }
});
test('metadata preserves safe presets and rejects executable fields, paths, and oversized records', () => {
  const out = validateResource({
    ...resource,
    presetId: 'kinetic',
    settings: { text: 'A < B', adjust: { contrast: 110 }, color: '#88aa99' },
    recipe: { format: '9:16', styleId: 'style-1', duration: 12, requires: ['media'] },
  });
  assert.equal(out.presetId, 'kinetic');
  assert.equal(out.settings.text, 'A < B');
  assert.equal(out.recipe.styleId, 'style-1');
  assert.throws(() => validateResource({ ...resource, settings: { code: 'fetch("evil")' } }));
  assert.throws(() => validateResource({ ...resource, settings: { url: 'https://evil.test' } }));
  assert.throws(() => validateResource({ ...resource, recipe: { styleId: '../../private' } }));
  assert.throws(() => validateResource({ ...resource, extra: 'x'.repeat(17000) }));
  assert.throws(() => validateResource({ ...resource, preview: 'library/bg-paint-1Xsvg' }));
});
test('admin preflight and responses allow only configured origins, including validation failures', async () => {
  const env = environment(),
    other = 'https://approved.example';
  env.CATALOG_ADMIN_ORIGINS = other;
  let response = await handleCatalog(
    req('/catalog/admin/catalog', {
      method: 'OPTIONS',
      headers: {
        Origin: other,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization,Content-Type',
      },
    }),
    env,
  );
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), other);
  assert.match(response.headers.get('Access-Control-Allow-Headers'), /Authorization/);
  assert.equal(env.calls.length, 0);
  response = await handleCatalog(
    req('/catalog/admin/catalog', {
      method: 'POST',
      headers: { Origin: other, Authorization: token, 'Content-Type': 'application/json' },
      body: '{}',
    }),
    env,
  );
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), other);
  response = await handleCatalog(
    req('/catalog/admin/catalog', { method: 'OPTIONS', headers: { Origin: 'https://evil.test' } }),
    env,
  );
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});
test('catalog raw request limit rejects a body beyond 2 MB before storing metadata', async () => {
  const env = environment(),
    response = await handleCatalog(
      req('/catalog/admin/catalog', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: ' '.repeat(2 * 1024 * 1024 + 1),
      }),
      env,
    );
  assert.equal(response.status, 413);
  assert.equal(env.calls.filter((call) => call.sql?.startsWith('INSERT')).length, 0);
});
