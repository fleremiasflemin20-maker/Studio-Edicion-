import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, createHash, randomBytes, sign } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { handleAccounts, b64 } from './accounts.mjs';
export const HOST = 'https://fleremahias-studio.analista-datos-pro.workers.dev';
export function environment() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('./accounts-schema.sql', import.meta.url), 'utf8'));
  const wrap = (sql, values = []) => ({
    bind(...args) {
      return wrap(sql, args);
    },
    async first() {
      return sqlite.prepare(sql).get(...values) || null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...values) };
    },
    async run() {
      const r = sqlite.prepare(sql).run(...values);
      return { success: true, meta: { changes: Number(r.changes) } };
    },
  });
  const db = {
    prepare: (sql) => wrap(sql),
    async batch(ops) {
      sqlite.exec('BEGIN');
      try {
        const out = [];
        for (const op of ops) out.push(await op.run());
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
  const files = new Map();
  const env = {
    LIBRARY_DB: db,
    USER_MEDIA: {
      async put(key, bytes) {
        files.set(key, new Uint8Array(bytes));
      },
      async get(key) {
        const data = files.get(key);
        return data ? { body: data } : null;
      },
      async delete(key) {
        files.delete(key);
      },
    },
    PROJECT_ROOMS: {
      idFromName: (id) => id,
      get: () => ({ fetch: async () => Response.json({ ok: true }) }),
    },
    ACCOUNT_ORIGINS: HOST,
    AI_ENABLED: 'false',
  };
  return { env, sqlite, files };
}
export function request(path, method = 'GET', data, token) {
  return new Request(HOST + path, {
    method,
    headers: {
      Origin: HOST,
      ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
}
export function credential() {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }),
    jwk = pair.publicKey.export({ format: 'jwk' });
  return {
    id: b64(randomBytes(32)),
    privateKey: pair.privateKey,
    x: Buffer.from(jwk.x, 'base64url'),
    y: Buffer.from(jwk.y, 'base64url'),
  };
}
export function registration(key, challenge, site = HOST) {
  const client = Buffer.from(
      JSON.stringify({ type: 'webauthn.create', challenge, origin: site, crossOrigin: false }),
    ),
    id = Buffer.from(key.id, 'base64url'),
    cose = isoCBOR.encode(
      new Map([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, key.x],
        [-3, key.y],
      ]),
    ),
    length = Buffer.alloc(2);
  length.writeUInt16BE(id.length);
  const auth = Buffer.concat([
    createHash('sha256').update(new URL(site).hostname).digest(),
    Buffer.from([69]),
    Buffer.alloc(4),
    Buffer.alloc(16),
    length,
    id,
    cose,
  ]);
  const attestation = isoCBOR.encode(
    new Map([
      ['fmt', 'none'],
      ['attStmt', new Map()],
      ['authData', auth],
    ]),
  );
  return {
    id: key.id,
    rawId: key.id,
    type: 'public-key',
    authenticatorAttachment: 'platform',
    clientExtensionResults: {},
    response: {
      clientDataJSON: b64(client),
      attestationObject: b64(attestation),
      transports: ['internal'],
    },
  };
}
export function assertion(key, challenge, counter = 1, site = HOST) {
  const client = Buffer.from(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: site, crossOrigin: false }),
    ),
    count = Buffer.alloc(4);
  count.writeUInt32BE(counter);
  const authenticator = Buffer.concat([
      createHash('sha256').update(new URL(site).hostname).digest(),
      Buffer.from([5]),
      count,
    ]),
    signature = sign(
      'sha256',
      Buffer.concat([authenticator, createHash('sha256').update(client).digest()]),
      key.privateKey,
    );
  return {
    id: key.id,
    rawId: key.id,
    type: 'public-key',
    authenticatorAttachment: 'platform',
    clientExtensionResults: {},
    response: {
      clientDataJSON: b64(client),
      authenticatorData: b64(authenticator),
      signature: b64(signature),
      userHandle: null,
    },
  };
}
export async function account(env, name = 'QA account') {
  const key = credential();
  const r = await handleAccounts(request('/accounts/v1/register/options', 'POST', { name }), env),
    options = await r.json();
  if (!r.ok) throw Error(JSON.stringify(options));
  const registered = await handleAccounts(
      request('/accounts/v1/register/verify', 'POST', {
        id: options.id,
        response: registration(key, options.options.challenge),
      }),
      env,
    ),
    data = await registered.json();
  if (!registered.ok) throw Error(JSON.stringify(data));
  return { ...data, key };
}
