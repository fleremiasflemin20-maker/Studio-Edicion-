import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAccounts } from './accounts.mjs';
import { handleWorkspace, validateDocument } from './workspace.mjs';
import { applyPatches } from './project-room.mjs';
import { handleImageAI } from './images.mjs';
import {
  environment,
  request,
  account,
  assertion,
  registration,
  credential,
  HOST,
} from './accounts-fixture.mjs';
const doc = () => ({
  id: crypto.randomUUID(),
  name: 'Shared project',
  format: '9:16',
  scenes: [{ id: crypto.randomUUID(), layers: [], duration: 6, text: 'Original', asset: null }],
  activeScene: '',
  audioTracks: [],
});
test('real WebAuthn registration and signed authentication reject reused challenges and wrong origin', async () => {
  const { env } = environment(),
    a = await account(env);
  const options = await (
    await handleAccounts(request('/accounts/v1/login/options', 'POST', {}), env)
  ).json();
  const payload = { id: options.id, response: assertion(a.key, options.options.challenge) };
  const ok = await handleAccounts(request('/accounts/v1/login/verify', 'POST', payload), env);
  assert.equal(ok.status, 200);
  assert.ok((await ok.json()).token);
  assert.equal(
    (await handleAccounts(request('/accounts/v1/login/verify', 'POST', payload), env)).status,
    400,
  );
  const options2 = await (
    await handleAccounts(request('/accounts/v1/login/options', 'POST', {}), env)
  ).json();
  assert.equal(
    (
      await handleAccounts(
        request('/accounts/v1/login/verify', 'POST', {
          id: options2.id,
          response: assertion(a.key, options2.options.challenge, 2, 'https://evil.example'),
        }),
        env,
      )
    ).status,
    400,
  );
});
test('sessions expire, logout revokes and recovery codes are one-time', async () => {
  const { env, sqlite } = environment(),
    a = await account(env);
  const codes = await (
    await handleAccounts(request('/accounts/v1/recovery', 'POST', {}, a.token), env)
  ).json();
  assert.equal(codes.codes.length, 8);
  const recovered = await handleAccounts(
    request('/accounts/v1/recover', 'POST', { code: codes.codes[0] }),
    env,
  );
  assert.equal(recovered.status, 200);
  assert.equal(
    (await handleAccounts(request('/accounts/v1/recover', 'POST', { code: codes.codes[0] }), env))
      .status,
    401,
  );
  await handleAccounts(request('/accounts/v1/logout', 'POST', {}, a.token), env);
  assert.equal(
    (await handleAccounts(request('/accounts/v1/me', 'GET', undefined, a.token), env)).status,
    401,
  );
  const fresh = await account(env, 'Other');
  sqlite.exec('UPDATE studio_sessions SET expires=0');
  assert.equal(
    (await handleAccounts(request('/accounts/v1/me', 'GET', undefined, fresh.token), env)).status,
    401,
  );
});
test('cloud projects isolate users and invitations grant only their server-side role', async () => {
  const { env } = environment(),
    a = await account(env, 'A'),
    b = await account(env, 'B');
  const created = await (
    await handleWorkspace(request('/cloud/v1/projects', 'POST', { document: doc() }, a.token), env)
  ).json();
  assert.ok(created.id);
  assert.equal(
    (
      await handleWorkspace(
        request('/cloud/v1/projects/' + created.id, 'GET', undefined, b.token),
        env,
      )
    ).status,
    404,
  );
  const invite = await (
    await handleWorkspace(
      request('/cloud/v1/projects/' + created.id + '/invite', 'POST', { role: 'viewer' }, a.token),
      env,
    )
  ).json();
  assert.equal(
    (
      await handleWorkspace(
        request('/cloud/v1/invitations/accept', 'POST', { token: invite.token }, b.token),
        env,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handleWorkspace(
        request('/cloud/v1/projects/' + created.id, 'GET', undefined, b.token),
        env,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handleWorkspace(
        request(
          '/cloud/v1/projects/' + created.id,
          'PUT',
          { document: doc(), revision: 1 },
          b.token,
        ),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleWorkspace(
        request('/cloud/v1/invitations/accept', 'POST', { token: invite.token }, b.token),
        env,
      )
    ).status,
    410,
  );
  await handleWorkspace(
    request(
      '/cloud/v1/projects/' + created.id + '/members',
      'DELETE',
      { userId: b.user.id },
      a.token,
    ),
    env,
  );
  assert.equal(
    (
      await handleWorkspace(
        request('/cloud/v1/projects/' + created.id, 'GET', undefined, b.token),
        env,
      )
    ).status,
    404,
  );
});
test('project writes use revision checks and reject foreign media and prototype paths', async () => {
  const { env } = environment(),
    a = await account(env);
  const created = await (
    await handleWorkspace(request('/cloud/v1/projects', 'POST', { document: doc() }, a.token), env)
  ).json();
  const updated = { ...created.document, name: 'Updated' };
  assert.equal(
    (
      await handleWorkspace(
        request(
          '/cloud/v1/projects/' + created.id,
          'PUT',
          { document: updated, revision: 1 },
          a.token,
        ),
        env,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handleWorkspace(
        request(
          '/cloud/v1/projects/' + created.id,
          'PUT',
          { document: updated, revision: 1 },
          a.token,
        ),
        env,
      )
    ).status,
    409,
  );
  const foreign = doc();
  foreign.scenes[0].asset = crypto.randomUUID();
  assert.equal(
    (
      await handleWorkspace(
        request('/cloud/v1/projects', 'POST', { document: foreign }, a.token),
        env,
      )
    ).status,
    403,
  );
  assert.throws(() => applyPatches({}, [{ path: ['__proto__', 'polluted'], value: true }]));
  const x = doc(),
    id = x.scenes[0].id;
  let y = applyPatches(x, [{ path: ['scenes', id, 'text'], before: 'Original', value: 'A' }]);
  y = applyPatches(y, [{ path: ['name'], before: 'Shared project', value: 'B' }]);
  assert.equal(y.scenes[0].text, 'A');
  assert.equal(y.name, 'B');
  assert.throws(() =>
    applyPatches(y, [{ path: ['scenes', id, 'text'], before: 'Original', value: 'C' }]),
  );
});
test('AI is disabled until authorized and its jobs are user isolated with bounded prompts', async () => {
  const { env } = environment(),
    a = await account(env),
    b = await account(env, 'B'),
    pending = [];
  const ctx = { waitUntil: (p) => pending.push(p) };
  assert.equal(
    (
      await handleImageAI(
        request('/images/v1/jobs', 'POST', { prompt: 'A realistic original landscape' }, a.token),
        env,
        ctx,
      )
    ).status,
    503,
  );
  env.AI_ENABLED = 'true';
  env.AI = {
    run: async () => {
      throw Error('Provider failed');
    },
  };
  assert.equal(
    (
      await handleImageAI(
        request('/images/v1/jobs', 'POST', { prompt: 'short' }, a.token),
        env,
        ctx,
      )
    ).status,
    400,
  );
  const job = await (
    await handleImageAI(
      request('/images/v1/jobs', 'POST', { prompt: 'A realistic original landscape' }, a.token),
      env,
      ctx,
    )
  ).json();
  await Promise.all(pending);
  assert.equal(
    (await handleImageAI(request('/images/v1/jobs/' + job.id, 'GET', undefined, b.token), env, ctx))
      .status,
    404,
  );
  assert.equal(
    (
      await (
        await handleImageAI(
          request('/images/v1/jobs/' + job.id, 'GET', undefined, a.token),
          env,
          ctx,
        )
      ).json()
    ).status,
    'failed',
  );
  for (let i = 0; i < 2; i++)
    await handleImageAI(
      request('/images/v1/jobs', 'POST', { prompt: 'A realistic original landscape' }, a.token),
      env,
      ctx,
    );
  assert.equal(
    (
      await handleImageAI(
        request('/images/v1/jobs', 'POST', { prompt: 'A realistic original landscape' }, a.token),
        env,
        ctx,
      )
    ).status,
    429,
  );
  await Promise.all(pending);
});

test('private media is shared only through membership and is revoked with access', async () => {
  const { env } = environment(),
    a = await account(env),
    b = await account(env, 'Viewer');
  const { saveAsset } = await import('./workspace.mjs');
  const png = Uint8Array.from(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
      'base64',
    ),
  );
  const asset = await saveAsset(env, a.user, png, 'Pixel.png', 'image/png');
  await assert.rejects(
    saveAsset(env, a.user, new TextEncoder().encode('<svg/>'), 'Bad.png', 'image/png'),
  );
  assert.equal(
    (await handleWorkspace(request('/cloud/v1/assets/' + asset.id, 'GET', undefined, b.token), env))
      .status,
    404,
  );
  const d = doc();
  d.scenes[0].asset = asset.id;
  const project = await (
    await handleWorkspace(request('/cloud/v1/projects', 'POST', { document: d }, a.token), env)
  ).json();
  const invitation = await (
    await handleWorkspace(
      request('/cloud/v1/projects/' + project.id + '/invite', 'POST', { role: 'viewer' }, a.token),
      env,
    )
  ).json();
  await handleWorkspace(
    request('/cloud/v1/invitations/accept', 'POST', { token: invitation.token }, b.token),
    env,
  );
  const file = await handleWorkspace(
    request('/cloud/v1/assets/' + asset.id, 'GET', undefined, b.token),
    env,
  );
  assert.equal(file.status, 200);
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), png);
  await handleWorkspace(
    request(
      '/cloud/v1/projects/' + project.id + '/members',
      'DELETE',
      { userId: b.user.id },
      a.token,
    ),
    env,
  );
  assert.equal(
    (await handleWorkspace(request('/cloud/v1/assets/' + asset.id, 'GET', undefined, b.token), env))
      .status,
    404,
  );
});

test('socket tickets cannot outlive a revoked session and cannot be reused', async () => {
  const { env } = environment(),
    a = await account(env);
  const p = await (
    await handleWorkspace(request('/cloud/v1/projects', 'POST', { document: doc() }, a.token), env)
  ).json();
  const ticket = await (
    await handleWorkspace(
      request('/cloud/v1/projects/' + p.id + '/ticket', 'POST', {}, a.token),
      env,
    )
  ).json();
  await handleAccounts(request('/accounts/v1/logout', 'POST', {}, a.token), env);
  const connect = () =>
    new Request(HOST + '/cloud/v1/projects/' + p.id + '/live?ticket=' + ticket.ticket, {
      headers: { Origin: HOST, Upgrade: 'websocket' },
    });
  assert.equal((await handleWorkspace(connect(), env)).status, 401);
  assert.equal((await handleWorkspace(connect(), env)).status, 401);
});

test('global AI monthly ceiling blocks provider calls even from another account', async () => {
  const { env, sqlite } = environment(),
    a = await account(env);
  const month = new Date().toISOString().slice(0, 7);
  sqlite.prepare('INSERT INTO studio_limits(key,count) VALUES(?,?)').run('ai:month:' + month, 100);
  let invoked = false;
  env.AI_ENABLED = 'true';
  env.AI = {
    run: async () => {
      invoked = true;
    },
  };
  const r = await handleImageAI(
    request('/images/v1/jobs', 'POST', { prompt: 'A professional studio photograph' }, a.token),
    env,
    {
      waitUntil() {
        throw Error('Should not schedule');
      },
    },
  );
  assert.equal(r.status, 429);
  assert.equal(invoked, false);
});
