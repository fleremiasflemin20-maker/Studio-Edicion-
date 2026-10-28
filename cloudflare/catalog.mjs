/** Public original catalog and owner-only curated resource administration. Never reads private media. */
const TYPES = new Set(['background', 'element', 'style', 'title', 'transition', 'sound', 'recipe']);
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const MAX_UPLOAD = 5 * 1024 * 1024;
const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
function json(value, status = 200, publicResponse = true) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': publicResponse ? 'public,max-age=60' : 'no-store',
      ...(publicResponse ? { 'Access-Control-Allow-Origin': '*' } : {}),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
const SETTINGS_FIELDS = new Set([
  'brightness',
  'saturation',
  'filter',
  'adjust',
  'style',
  'animation',
  'animationDuration',
  'size',
  'x',
  'y',
  'width',
  'height',
  'color',
  'fill',
  'transition',
  'transitionDuration',
  'soundId',
  'motion',
  'zoom',
  'fit',
  'cropX',
  'cropY',
  'rotation',
  'opacity',
  'font',
  'fontSize',
  'titleStyle',
  'text',
  'textX',
  'textY',
  'bg',
  'background',
  'duration',
  'subtitleStyle',
]);
const ADJUST_FIELDS = new Set(['contrast', 'temperature', 'hue', 'grain', 'vignette', 'blur']);
const EFFECT_FIELDS = new Set([
  'exposure',
  'contrast',
  'saturation',
  'temperature',
  'hue',
  'grain',
  'vignette',
  'gamma',
  'shadows',
  'highlights',
]);
const CUSTOM_FIELDS = new Set([
  'name',
  'exposure',
  'contrast',
  'saturation',
  'temperature',
  'gamma',
  'shadows',
  'highlights',
  'intensity',
  'texture',
  'textureStrength',
  'paintColor',
  'seed',
  'motion',
  'lut',
  'timeOffset',
]);
const RECIPE_FIELDS = new Set([
  'objective',
  'format',
  'styleId',
  'titleId',
  'transitionId',
  'duration',
  'requires',
  'preset',
  'presetId',
  'motionPreset',
]);
function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function boundedJSON(value, fields, kind) {
  if (!plain(value)) throw Error(kind + ' must be a metadata object.');
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (!fields.has(key)) throw Error('Unsupported ' + kind + ' field: ' + key);
    if (key === 'adjust') {
      output.adjust = boundedJSON(item, ADJUST_FIELDS, 'adjustments');
      continue;
    }
    if (key === 'lut') {
      if (item === null) {
        output.lut = null;
        continue;
      }
      if (
        !plain(item) ||
        !Number.isInteger(item.size) ||
        item.size < 2 ||
        item.size > 33 ||
        !Array.isArray(item.values) ||
        item.values.length !== item.size ** 3 * 3 ||
        item.values.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)
      )
        throw Error('Invalid metadata LUT.');
      const min = item.domainMin || [0, 0, 0],
        max = item.domainMax || [1, 1, 1];
      if (
        ![min, max].every(
          (v) =>
            Array.isArray(v) &&
            v.length === 3 &&
            v.every((x) => typeof x === 'number' && Number.isFinite(x)),
        ) ||
        max.some((v, i) => v <= min[i])
      )
        throw Error('Invalid metadata LUT domain.');
      output.lut = {
        size: item.size,
        values: item.values.slice(),
        domainMin: min.slice(),
        domainMax: max.slice(),
        title: String(item.title || '').slice(0, 80),
      };
      continue;
    }
    if (key === 'requires') {
      if (
        !Array.isArray(item) ||
        item.length > 20 ||
        item.some((v) => typeof v !== 'string' || !ID.test(v))
      )
        throw Error('Invalid recipe requirements.');
      output.requires = item.slice();
      continue;
    }
    if (typeof item === 'number') {
      if (!Number.isFinite(item) || Math.abs(item) > 100000)
        throw Error('Invalid ' + kind + ' number.');
      output[key] = item;
      continue;
    }
    if (typeof item !== 'string' || item.length > (['name', 'text'].includes(key) ? 1000 : 100))
      throw Error('Invalid ' + kind + ' value.');
    if (['color', 'fill', 'bg', 'paintColor'].includes(key) && !/^#[a-f0-9]{6}$/i.test(item))
      throw Error('Use a hex metadata color.');
    if (key === 'format' && !['9:16', '16:9', '4:5', '1:1'].includes(item))
      throw Error('Invalid metadata aspect ratio.');
    if (
      !['name', 'text', 'format', 'color', 'fill', 'bg', 'paintColor'].includes(key) &&
      !ID.test(item)
    )
      throw Error('Metadata identifiers cannot contain paths or executable content.');
    output[key] = item;
  }
  return output;
}
function validateResource(value) {
  if (!plain(value) || !ID.test(value.id) || !TYPES.has(value.type))
    throw Error('Invalid resource id or type.');
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 16384)
    throw Error('Each resource is limited to 16 KB of metadata.');
  const name = String(value.name || '').trim(),
    nameEn = String(value.nameEn || '').trim(),
    license = String(value.license || '').trim();
  if (
    !name ||
    name.length > 120 ||
    !nameEn ||
    nameEn.length > 120 ||
    !license ||
    license.length > 240
  )
    throw Error('Names and a license are required.');
  const preview = String(value.preview || '');
  if (!new RegExp('^library/' + value.id + '\\.(svg|png|wav)$').test(preview))
    throw Error('Resource preview must use its curated library id.');
  if (value.type === 'sound' && !preview.endsWith('.wav'))
    throw Error('Sound resources require WAV.');
  if (value.type !== 'sound' && preview.endsWith('.wav'))
    throw Error('Visual resources require an image.');
  const metadata = {
    id: value.id,
    type: value.type,
    name,
    nameEn,
    license,
    version: Math.max(1, Math.min(100000, Math.floor(Number(value.version) || 1))),
    tags: Array.isArray(value.tags)
      ? value.tags.slice(0, 40).map((v) => String(v).slice(0, 60))
      : [],
    preview,
  };
  if (value.family) metadata.family = String(value.family).slice(0, 80);
  if (value.provenance && typeof value.provenance === 'object')
    metadata.provenance = {
      author: String(value.provenance.author || '').slice(0, 120),
      source: String(value.provenance.source || '').slice(0, 300),
      license,
      rights: String(value.provenance.rights || '').slice(0, 1000),
      generatedWithAI: value.provenance.generatedWithAI === true,
    };
  for (const [field, fields] of [
    ['settings', SETTINGS_FIELDS],
    ['customFilter', CUSTOM_FIELDS],
    ['recipe', RECIPE_FIELDS],
    ['effects', EFFECT_FIELDS],
  ])
    if (value[field] !== undefined) metadata[field] = boundedJSON(value[field], fields, field);
  for (const key of [
    'preset',
    'presetId',
    'styleId',
    'titleId',
    'transitionId',
    'soundId',
    'motionPreset',
    'animation',
    'visual',
    'soundFamily',
    'objective',
  ])
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'string' || !ID.test(value[key]))
        throw Error('Invalid preset identifier.');
      metadata[key] = value[key];
    }
  for (const key of ['variant', 'width', 'height', 'duration', 'sampleRate'])
    if (value[key] !== undefined) {
      if (
        typeof value[key] !== 'number' ||
        !Number.isFinite(value[key]) ||
        value[key] < 0 ||
        value[key] > 192000
      )
        throw Error('Invalid resource dimensions or timing.');
      metadata[key] = value[key];
    }
  if (value.accent !== undefined) {
    if (!/^#[a-f0-9]{6}$/i.test(value.accent)) throw Error('Invalid accent color.');
    metadata.accent = value.accent;
  }
  if (value.supports !== undefined) {
    if (
      !Array.isArray(value.supports) ||
      value.supports.some((v) => !['image', 'video', 'audio'].includes(v))
    )
      throw Error('Invalid resource compatibility.');
    metadata.supports = [...new Set(value.supports)];
  }
  if (value.steps !== undefined) {
    if (
      !Array.isArray(value.steps) ||
      value.steps.length > 20 ||
      value.steps.some((v) => typeof v !== 'string' || v.length > 300)
    )
      throw Error('Invalid recipe steps.');
    metadata.steps = value.steps.slice();
  }
  return metadata;
}
function adminOrigin(request, env) {
  const url = new URL(request.url),
    origin = request.headers.get('Origin') || url.origin;
  const configured = String(env.CATALOG_ADMIN_ORIGINS || env.LUMA_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([url.origin, ...configured]).has(origin) ? origin : null;
}
async function readMetadata(request) {
  const max = 2 * 1024 * 1024,
    length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || +length > max)) return null;
  if (!request.body) return '';
  const buffer = new Uint8Array(length !== null ? +length : max),
    reader = request.body.getReader();
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > buffer.byteLength) {
        await reader.cancel();
        return null;
      }
      buffer.set(value, size);
      size += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder().decode(buffer.subarray(0, size));
}
function upsert(db, value) {
  const search = normalize([value.name, value.nameEn, ...value.tags].join(' '));
  return db
    .prepare(
      'INSERT INTO resources (id,type,name,name_en,tags,license,version,preview,metadata,search_text,published) VALUES (?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET type=excluded.type,name=excluded.name,name_en=excluded.name_en,tags=excluded.tags,license=excluded.license,version=excluded.version,preview=excluded.preview,metadata=excluded.metadata,search_text=excluded.search_text,published=1,updated_at=CURRENT_TIMESTAMP',
    )
    .bind(
      value.id,
      value.type,
      value.name,
      value.nameEn,
      JSON.stringify(value.tags),
      value.license,
      value.version,
      value.preview,
      JSON.stringify(value),
      search,
    );
}

async function authorize(request, env) {
  const url = new URL(request.url),
    origin = adminOrigin(request, env);
  if (!origin) return { response: json({ error: 'Origin not allowed.' }, 403, false) };
  const token = request.headers.get('Authorization');
  if (!/^Bearer [^\s]{8,500}$/.test(token || ''))
    return { response: json({ error: 'Owner authorization required.' }, 401, false) };
  if (!env.PRIVATE_SERVICE?.fetch)
    return {
      response: json({ error: 'Owner authentication service is unavailable.' }, 503, false),
    };
  const healthURL = new URL('/api/status', url);
  const check = await env.PRIVATE_SERVICE.fetch(
    new Request(healthURL, { headers: { Authorization: token, Origin: origin } }),
  );
  if (!check.ok)
    return {
      response: json(
        { error: 'Owner authorization rejected.' },
        check.status === 401 ? 401 : 403,
        false,
      ),
    };
  return { origin };
}
function rowItem(row) {
  try {
    return JSON.parse(row.metadata);
  } catch {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      nameEn: row.name_en,
      preview: row.preview,
      license: row.license,
      version: row.version,
      tags: [],
    };
  }
}
async function list(request, env) {
  if (!env.LIBRARY_DB) return json({ error: 'Catalog database is not configured.' }, 503);
  const url = new URL(request.url),
    type = url.searchParams.get('type') || '',
    query = normalize(url.searchParams.get('q') || '').slice(0, 160),
    limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '40', 10) || 40)),
    offset = Math.max(
      0,
      Math.min(100000, parseInt(url.searchParams.get('offset') || '0', 10) || 0),
    );
  if (type && !TYPES.has(type)) return json({ error: 'Unknown resource type.' }, 400);
  const terms = query.split(' ').filter(Boolean).slice(0, 8),
    where = ['published = 1'],
    args = [];
  if (type) {
    where.push('type = ?');
    args.push(type);
  }
  for (const term of terms) {
    where.push("search_text LIKE ? ESCAPE '\\'");
    args.push('%' + term.replace(/[\\%_]/g, (v) => '\\' + v) + '%');
  }
  const clause = where.join(' AND '),
    result = await env.LIBRARY_DB.prepare(
      `SELECT * FROM resources WHERE ${clause} ORDER BY type, id LIMIT ? OFFSET ?`,
    )
      .bind(...args, limit, offset)
      .all();
  const total = await env.LIBRARY_DB.prepare(
    `SELECT COUNT(*) AS total FROM resources WHERE ${clause}`,
  )
    .bind(...args)
    .first();
  return json({
    version: 1,
    items: (result.results || []).map(rowItem),
    total: total?.total || 0,
    limit,
    offset,
  });
}
async function asset(request, env, id) {
  if (!ID.test(id)) return json({ error: 'Invalid resource id.' }, 400);
  const url = new URL(request.url);
  let row = null;
  if (env.LIBRARY_DB)
    row = await env.LIBRARY_DB.prepare('SELECT * FROM resources WHERE id = ? AND published = 1')
      .bind(id)
      .first();
  if (env.LIBRARY_MEDIA) {
    const extension = row?.preview?.endsWith('.wav')
      ? 'wav'
      : row?.preview?.endsWith('.png')
        ? 'png'
        : null;
    if (extension) {
      const object = await env.LIBRARY_MEDIA.get(`catalog/${id}.${extension}`);
      if (object) {
        const headers = new Headers({
          'Content-Type': extension === 'wav' ? 'audio/wav' : 'image/png',
          'Cache-Control': 'public,max-age=86400',
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff',
        });
        if (object.httpEtag) headers.set('ETag', object.httpEtag);
        return new Response(request.method === 'HEAD' ? null : object.body, { headers });
      }
    }
  }
  if (!row && !env.LIBRARY_DB)
    row = { preview: 'library/' + id + (id.startsWith('sfx-') ? '.wav' : '.svg') };
  if (!row) return json({ error: 'Resource not found.' }, 404);
  if (!env.ASSETS?.fetch) return json({ error: 'Static library is unavailable.' }, 503);
  const assetURL = new URL('/' + row.preview, url);
  const response = await env.ASSETS.fetch(new Request(assetURL, { method: request.method }));
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, { status: response.status, headers });
}
async function admin(request, env, path) {
  const auth = await authorize(request, env);
  if (auth.response) return auth.response;
  if (!env.LIBRARY_DB) return json({ error: 'Catalog database is not configured.' }, 503, false);
  if (path === '/catalog/admin/status' && request.method === 'GET') {
    const counts = await env.LIBRARY_DB.prepare(
      'SELECT type, COUNT(*) AS total FROM resources GROUP BY type',
    ).all();
    return json(
      { database: true, curatedStorage: !!env.LIBRARY_MEDIA, counts: counts.results || [] },
      200,
      false,
    );
  }
  if (path === '/catalog/admin/catalog' && request.method === 'POST') {
    const raw = await readMetadata(request);
    if (raw === null) return json({ error: 'Catalog metadata exceeds 2 MB.' }, 413, false);
    let values, batch;
    try {
      const data = JSON.parse(raw);
      batch = Object.hasOwn(data || {}, 'items');
      if (batch && (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 300))
        throw Error('A batch requires between 1 and 300 resources.');
      values = (batch ? data.items : [data]).map(validateResource);
      if (new Set(values.map((v) => v.id)).size !== values.length)
        throw Error('Duplicate resource identifiers in batch.');
    } catch (error) {
      return json({ error: error.message }, 400, false);
    }
    if (batch) {
      if (typeof env.LIBRARY_DB.batch !== 'function')
        return json({ error: 'Catalog batch writes are unavailable.' }, 503, false);
      for (let i = 0; i < values.length; i += 50)
        await env.LIBRARY_DB.batch(
          values.slice(i, i + 50).map((value) => upsert(env.LIBRARY_DB, value)),
        );
      return json(
        { saved: true, count: values.length, ids: values.map((value) => value.id) },
        200,
        false,
      );
    }
    await upsert(env.LIBRARY_DB, values[0]).run();
    return json({ saved: true, resource: values[0] }, 200, false);
  }

  const match = path.match(/^\/catalog\/admin\/assets\/([a-z0-9-]+)$/);
  if (match && request.method === 'PUT') {
    if (!env.LIBRARY_MEDIA)
      return json({ error: 'Curated storage is not configured.' }, 503, false);
    const id = match[1];
    if (!ID.test(id)) return json({ error: 'Invalid resource id.' }, 400, false);
    const row = await env.LIBRARY_DB.prepare('SELECT * FROM resources WHERE id = ?')
      .bind(id)
      .first();
    if (!row)
      return json({ error: 'Save catalog metadata before uploading an asset.' }, 404, false);
    const type = request.headers.get('Content-Type')?.split(';')[0];
    if (!['image/png', 'audio/wav'].includes(type))
      return json({ error: 'Curated uploads support PNG or PCM WAV only.' }, 415, false);
    if (Number(request.headers.get('Content-Length') || 0) > MAX_UPLOAD)
      return json({ error: 'Maximum asset size is 5 MB.' }, 413, false);
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Empty upload.' }, 400, false);
    const chunks = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_UPLOAD) {
          await reader.cancel();
          return json({ error: 'Maximum asset size is 5 MB.' }, 413, false);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.byteLength;
    }
    const png = type === 'image/png',
      extension = png ? 'png' : 'wav';
    if (row.preview !== `library/${id}.${extension}`)
      return json({ error: 'Upload type must match the catalog preview.' }, 400, false);
    if (png) {
      if (bytes.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
        return json({ error: 'Invalid PNG signature.' }, 400, false);
      const v = new DataView(bytes.buffer);
      if (v.getUint32(16) > 4096 || v.getUint32(20) > 4096 || !v.getUint32(16) || !v.getUint32(20))
        return json({ error: 'PNG dimensions must be between 1 and 4096.' }, 400, false);
    } else if (
      bytes.length < 44 ||
      String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF' ||
      String.fromCharCode(...bytes.slice(8, 12)) !== 'WAVE'
    )
      return json({ error: 'Invalid WAV signature.' }, 400, false);
    if (!png) {
      const pcm = new DataView(bytes.buffer);
      if (
        String.fromCharCode(...bytes.slice(12, 16)) !== 'fmt ' ||
        pcm.getUint16(20, true) !== 1 ||
        ![1, 2].includes(pcm.getUint16(22, true)) ||
        pcm.getUint32(24, true) < 8000 ||
        pcm.getUint32(24, true) > 192000 ||
        ![8, 16, 24, 32].includes(pcm.getUint16(34, true)) ||
        pcm.getUint32(4, true) + 8 > bytes.length
      )
        return json({ error: 'Only valid uncompressed PCM WAV is supported.' }, 400, false);
    }
    await env.LIBRARY_MEDIA.put(`catalog/${id}.${extension}`, bytes, {
      httpMetadata: { contentType: type },
    });
    return json({ uploaded: true, id, size: length }, 200, false);
  }
  return json({ error: 'Catalog administration route or method not found.' }, 404, false);
}
export async function handleCatalog(request, env) {
  const path = new URL(request.url).pathname;
  try {
    if (path.startsWith('/catalog/admin/')) {
      const origin = adminOrigin(request, env);
      if (!origin) return json({ error: 'Origin not allowed.' }, 403, false);
      let response;
      if (request.method === 'OPTIONS')
        response = new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization,Content-Type',
            'Access-Control-Max-Age': '600',
          },
        });
      else
        try {
          response = await admin(request, env, path);
        } catch {
          response = json({ error: 'Catalog service is temporarily unavailable.' }, 503, false);
        }
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Vary', 'Origin');
      return new Response(response.body, { status: response.status, headers });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method))
      return json({ error: 'Method not allowed.' }, 405);
    if (request.method === 'OPTIONS')
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
        },
      });
    if (path === '/catalog/v1/resources') return await list(request, env);
    const match = path.match(/^\/catalog\/v1\/assets\/([a-z0-9-]+)$/);
    if (match) return await asset(request, env, match[1]);
    return json({ error: 'Catalog route not found.' }, 404);
  } catch {
    return json(
      { error: 'Catalog service is temporarily unavailable.' },
      503,
      !path.startsWith('/catalog/admin/'),
    );
  }
}
export { validateResource };
