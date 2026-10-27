import { test } from 'node:test';
import assert from 'node:assert/strict';
import studio from './studio.mjs';
test('Branded studio serves public assets from its own deployment', async () => {
  let assetURL;
  const response = await studio.fetch(new Request('https://fleremahias.test/'), {
    ASSETS: {
      fetch: async (request) => {
        assetURL = request.url;
        return new Response('Fleremahias Studio');
      },
    },
  });
  assert.equal(new URL(assetURL).pathname, '/index.html');
  assert.equal(await response.text(), 'Fleremahias Studio');
});
test('Private routes preserve request origin and authentication when delegated', async () => {
  for (const path of ['/api/status', '/oauth/youtube/callback', '/studio/index.html']) {
    const request = new Request('https://fleremahias.test' + path, {
      headers: { Authorization: 'Bearer test-owner-token', Origin: 'https://fleremahias.test' },
    });
    const response = await studio.fetch(request, {
      PRIVATE_SERVICE: {
        fetch: async (forwarded) => {
          assert.equal(forwarded, request);
          return new Response('private');
        },
      },
    });
    assert.equal(await response.text(), 'private');
  }
});
test('Public assets reject writes and the branded entrypoint does not bypass API authentication', async () => {
  assert.equal(
    (await studio.fetch(new Request('https://fleremahias.test/', { method: 'POST' }), {})).status,
    405,
  );
  const response = await studio.fetch(new Request('https://fleremahias.test/api/status'), {
    PRIVATE_SERVICE: { fetch: async () => new Response('Unauthorized', { status: 401 }) },
  });
  assert.equal(response.status, 401);
});
