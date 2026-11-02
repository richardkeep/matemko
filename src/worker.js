import { authRoute, currentUser, HttpError, authJson, sameOrigin, readBody } from './lib/auth.js';
// Serves the Vue build from ./dist and a small shared attempts API backed by D1.
//   GET  /api/attempts  -> top attempts, best first
//   POST /api/attempts  -> record an attempt

const OPS = ['+', '−', '×', '÷'];
const TOP_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// Returns a clean attempt, or null when the payload is not acceptable
function parseAttempt(body) {
  if (!body || typeof body !== 'object') return null;
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1 || name.length > 40) return null;
  if (!isInt(body.total, 1, 300) || !isInt(body.right, 0, body.total)) return null;
  if (!isInt(body.max, 1, 100000) || !isInt(body.durationMs, 0, DAY_MS)) return null;
  if (!Array.isArray(body.ops) || body.ops.length < 1 || body.ops.length > OPS.length) return null;
  if (!body.ops.every(op => OPS.includes(op)) || new Set(body.ops).size !== body.ops.length) return null;
  const endedAt = Date.now();
  return {
    name,
    startedAt: endedAt - body.durationMs,
    endedAt,
    ops: OPS.filter(op => body.ops.includes(op)).join(''),
    max: body.max,
    right: body.right,
    total: body.total,
  };
}

async function listAttempts(env) {
  const { results } = await env.DB.prepare(
    `SELECT name, started_at, ended_at, ops, max_result, correct, total, country
       FROM attempts
      ORDER BY CAST(correct AS REAL) / total DESC, correct DESC, ended_at - started_at ASC, id DESC
      LIMIT ?`
  ).bind(TOP_LIMIT).all();
  return json(results.map(r => ({
    name: r.name,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    ops: [...r.ops],
    max: r.max_result,
    right: r.correct,
    total: r.total,
    country: r.country,
  })));
}

async function createAttempt(request, env, user) {
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const a = parseAttempt(body);
  if (!a) return json({ error: 'Invalid attempt' }, 400);
  // Country comes from Cloudflare's IP lookup; XX = unknown, T1 = Tor
  const cc = request.cf?.country;
  const country = typeof cc === 'string' && /^[A-Z]{2}$/.test(cc) && cc !== 'XX' && cc !== 'T1' ? cc : null;
  await env.DB.prepare(
    `INSERT INTO attempts (name, started_at, ended_at, ops, max_result, correct, total, country, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(a.name, a.startedAt, a.endedAt, a.ops, a.max, a.right, a.total, country, user.id).run();
  return json({ ok: true }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/auth/')) return await authRoute(request, env, url.pathname);
      if (url.pathname === '/api/attempts') {
        const user = await currentUser(request, env);
        if (!user) return authJson({ error: 'Please sign in to continue.' }, 401);
        if (request.method === 'GET') return await listAttempts(env);
        if (request.method === 'POST') { sameOrigin(request); return await createAttempt(request, env, user); }
        return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' });
      }
      if (url.pathname.startsWith('/api/')) return authJson({ error: 'Not found.' }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof HttpError) return authJson({ error: error.message }, error.status, error.status === 429 ? { 'Retry-After': '900' } : {});
      console.error(JSON.stringify({ event: 'api_failure', path: url.pathname }));
      return authJson({ error: 'Something went wrong. Please try again.' }, 500);
    }
  },
};
