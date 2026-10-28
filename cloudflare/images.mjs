import { authenticate, body, cors, fail, json, origin, rate, uuid } from './accounts.mjs';
import { saveAsset } from './workspace.mjs';
export const MODEL = '@cf/black-forest-labs/flux-1-schnell';
export async function generateJob(env, user, id, prompt) {
  try {
    const result = await env.AI.run(MODEL, { prompt, steps: 4 });
    const row = await env.LIBRARY_DB.prepare(
      'SELECT status FROM studio_ai_jobs WHERE id=? AND user_id=?',
    )
      .bind(id, user.id)
      .first();
    if (row?.status !== 'processing') return;
    if (typeof result.image !== 'string' || result.image.length > 25000000)
      throw Error('Invalid image response');
    const bytes = Uint8Array.from(atob(result.image), (c) => c.charCodeAt(0));
    const asset = await saveAsset(
      env,
      user,
      bytes,
      'Fleremahias AI ' + id.slice(0, 8) + '.jpg',
      'image/jpeg',
    );
    await env.LIBRARY_DB.prepare(
      'UPDATE studio_ai_jobs SET status=?,asset_id=? WHERE id=? AND status=?',
    )
      .bind('completed', asset.id, id, 'processing')
      .run();
  } catch {
    await env.LIBRARY_DB.prepare(
      'UPDATE studio_ai_jobs SET status=?,error=? WHERE id=? AND status=?',
    )
      .bind(
        'failed',
        'La generación falló. El intento permanece reservado para proteger la cuota / Generation failed. The attempt remains reserved to protect the quota.',
        id,
        'processing',
      )
      .run();
  }
}
export async function handleImageAI(request, env, ctx) {
  let allowed;
  try {
    allowed = origin(request, env);
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), allowed);
    const user = await authenticate(request, env),
      db = env.LIBRARY_DB,
      path = new URL(request.url).pathname;
    if (path === '/images/v1/config' && request.method === 'GET')
      return cors(
        json({
          enabled: env.AI_ENABLED === 'true' && !!env.AI,
          model: MODEL,
          provider: 'Cloudflare Workers AI',
          perAccountPerDay: 3,
          globalPerDay: 20,
          globalPerMonth: 100,
          steps: 4,
          attemptsIncludeFailures: true,
          notice:
            'El texto se envía a Cloudflare para generar la imagen. Las salidas son privadas. / The prompt is sent to Cloudflare to generate the image. Outputs are private.',
        }),
        allowed,
      );
    if (path === '/images/v1/jobs' && request.method === 'GET') {
      const jobs = await db
        .prepare(
          'SELECT id,prompt,status,asset_id,error,created FROM studio_ai_jobs WHERE user_id=? ORDER BY created DESC LIMIT 30',
        )
        .bind(user.id)
        .all();
      return cors(json({ jobs: jobs.results }), allowed);
    }
    if (path === '/images/v1/jobs' && request.method === 'POST') {
      if (env.AI_ENABLED !== 'true' || !env.AI)
        fail(
          503,
          'La generación está preparada, pero el propietario debe autorizar su consumo / Generation is ready; the owner must authorize usage',
        );
      const data = await body(request, 10000),
        prompt = String(data.prompt || '').trim();
      if (prompt.length < 8 || prompt.length > 1000)
        fail(
          400,
          'Describe la imagen con 8–1000 caracteres / Describe the image with 8–1000 characters',
        );
      const now = new Date(),
        day = now.toISOString().slice(0, 10),
        month = day.slice(0, 7);
      await rate(db, 'ai:month:' + month, 100);
      await rate(db, 'ai:day:' + day, 20);
      await rate(db, 'ai:user:' + day + ':' + user.id, 3);
      const id = uuid();
      await db
        .prepare('INSERT INTO studio_ai_jobs(id,user_id,prompt,status,created) VALUES(?,?,?,?,?)')
        .bind(id, user.id, prompt, 'processing', Date.now())
        .run();
      ctx.waitUntil(generateJob(env, user, id, prompt));
      return cors(json({ id, status: 'processing' }, 202), allowed);
    }
    const match = path.match(/^\/images\/v1\/jobs\/([a-f0-9-]+)$/i);
    if (match) {
      const row = await db
        .prepare(
          'SELECT id,prompt,status,asset_id,error,created FROM studio_ai_jobs WHERE id=? AND user_id=?',
        )
        .bind(match[1], user.id)
        .first();
      if (!row) fail(404, 'Job not found');
      if (request.method === 'GET') return cors(json(row), allowed);
      if (request.method === 'DELETE') {
        await db
          .prepare('UPDATE studio_ai_jobs SET status=? WHERE id=? AND user_id=? AND status=?')
          .bind('canceled', row.id, user.id, 'processing')
          .run();
        return cors(
          json({ ok: true, notice: 'Canceling does not restore the reserved attempt.' }),
          allowed,
        );
      }
    }
    return cors(json({ error: 'Route not found' }, 404), allowed);
  } catch (error) {
    return cors(
      json(
        { error: error.status ? error.message : 'Image service unavailable' },
        error.status || 500,
      ),
      allowed,
    );
  }
}
