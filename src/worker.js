import { authRoute, currentUser, HttpError, authJson, sameOrigin, readBody } from './lib/auth.js';
import { cleanProblems, isCorrect } from './lib/worksheet.js';
// Serves the Vue build from ./dist and a small API backed by D1.
//   GET  /api/attempts       -> top attempts, best first (sums only for your own rounds)
//   POST /api/attempts       -> record an attempt
//   GET  /api/attempts/mine  -> your own most recent rounds, with their sums
//   /api/auth/*              -> accounts (see lib/auth.js)

const OPS = ['+', '−', '×', '÷'];
const TOP_LIMIT = 100;
const MINE_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// Returns a clean attempt, or null when the payload is not acceptable
export function parseAttempt(body) {
  if (!body || typeof body !== 'object') return null;
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1 || name.length > 80) return null;
  if (!isInt(body.total, 1, 300) || !isInt(body.right, 0, body.total)) return null;
  if (!isInt(body.max, 1, 100000) || !isInt(body.durationMs, 0, DAY_MS)) return null;
  if (!Array.isArray(body.ops) || body.ops.length < 1 || body.ops.length > OPS.length) return null;
  if (!body.ops.every(op => OPS.includes(op)) || new Set(body.ops).size !== body.ops.length) return null;
  // The sums are optional so pages loaded before they were added can still save; when sent, they must match the score
  let problems = null;
  if (body.problems !== undefined) {
    problems = cleanProblems(body.problems, body.total);
    if (!problems || !problems.every(p => body.ops.includes(p.op))) return null;
    if (problems.filter(p => isCorrect(p, p.answer)).length !== body.right) return null;
  }
  const endedAt = Date.now();
  return {
    name,
    startedAt: endedAt - body.durationMs,
    endedAt,
    ops: OPS.filter(op => body.ops.includes(op)).join(''),
    max: body.max,
    right: body.right,
    total: body.total,
    problems,
  };
}

const parseProblems = text => { try { return text ? JSON.parse(text) : null; } catch { return null; } };
const COLUMNS = 'id, name, started_at, ended_at, ops, max_result, correct, total, country, user_id, problems';
const roundJson = (r, withProblems) => ({
  id: r.id,
  name: r.name,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  ops: [...r.ops],
  max: r.max_result,
  right: r.correct,
  total: r.total,
  country: r.country,
  problems: withProblems ? parseProblems(r.problems) : null,
});

// Everyone sees the scores; a round's sums are only returned to the account that played it
async function listAttempts(env, user) {
  const { results } = await env.DB.prepare(
    `SELECT ${COLUMNS}
       FROM attempts
      ORDER BY CAST(correct AS REAL) / total DESC, correct DESC, ended_at - started_at ASC, id DESC
      LIMIT ?`
  ).bind(TOP_LIMIT).all();
  return json(results.map(r => ({ ...roundJson(r, r.user_id === user.id), mine: r.user_id === user.id })));
}

async function roundsFor(env, userId, limit = MINE_LIMIT) {
  const { results } = await env.DB.prepare(`SELECT ${COLUMNS} FROM attempts WHERE user_id = ? ORDER BY id DESC LIMIT ?`).bind(userId, limit).all();
  return results.map(r => roundJson(r, true));
}

async function createAttempt(request, env, user) {
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const a = parseAttempt({ ...body, name: user.name });
  if (!a) return json({ error: 'Invalid attempt' }, 400);
  // Country comes from Cloudflare's IP lookup; XX = unknown, T1 = Tor
  const cc = request.cf?.country;
  const country = typeof cc === 'string' && /^[A-Z]{2}$/.test(cc) && cc !== 'XX' && cc !== 'T1' ? cc : null;
  await env.DB.prepare(
    `INSERT INTO attempts (name, started_at, ended_at, ops, max_result, correct, total, country, user_id, problems)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(a.name, a.startedAt, a.endedAt, a.ops, a.max, a.right, a.total, country, user.id, a.problems && JSON.stringify(a.problems)).run();
  return json({ ok: true }, 201);
}

async function apiRoute(request, env, url) {
  const path = url.pathname;
  const user = await currentUser(request, env);
  if (!user) return authJson({ error: 'Please sign in to continue.' }, 401);
  if (path === '/api/attempts') {
    if (request.method === 'GET') return listAttempts(env, user);
    if (request.method === 'POST') { sameOrigin(request); return createAttempt(request, env, user); }
    return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' });
  }
  if (request.method === 'GET' && path === '/api/attempts/mine') return json(await roundsFor(env, user.id));
  return authJson({ error: 'Not found.' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]', 'terminal.local'].includes(url.hostname)) {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 308);
    }
    try {
      if (url.pathname.startsWith('/api/auth/')) return await authRoute(request, env, url.pathname);
      if (url.pathname.startsWith('/api/')) return await apiRoute(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof HttpError) return authJson({ error: error.message }, error.status, error.status === 429 ? { 'Retry-After': '900' } : {});
      console.error(JSON.stringify({ event: 'api_failure', path: url.pathname }));
      return authJson({ error: 'Something went wrong. Please try again.' }, 500);
    }
  },
};
