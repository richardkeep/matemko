import { authRoute, currentUser, HttpError, authJson, sameOrigin, readBody } from './lib/auth.js';
import { cleanProblems, isCorrect, trickySums, MODE_PATTERN, TIME_LIMITS } from './lib/worksheet.js';
import { cleanProgress, mergeProgress } from './lib/progress.js';
// Serves the Vue build from ./dist and a small API backed by D1.
//   GET  /api/attempts       -> top attempts, best first (sums only for your own rounds)
//   POST /api/attempts       -> record an attempt
//   GET  /api/attempts/mine  -> your own most recent rounds, with their sums
//   GET  /api/mistakes       -> sums you most recently got wrong or skipped
//   GET  /api/progress       -> your stars, stickers and streak
//   POST /api/progress       -> merge this device's progress into your account
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

// Every sum in a times-table or number-bond round must belong to that table or bond
function fitsMode(problem, mode) {
  const [kind, value] = mode.split('-');
  const n = Number(value);
  if (kind === 'table') return problem.op === '×' && (problem.a === n || problem.b === n);
  if (kind === 'bonds') return (problem.op === '+' && problem.c === n) || (problem.op === '−' && problem.a === n);
  return true;
}

// Returns a clean attempt, or null when the payload is not acceptable
export function parseAttempt(body) {
  if (!body || typeof body !== 'object') return null;
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1 || name.length > 80) return null;
  if (!isInt(body.total, 1, 300) || !isInt(body.right, 0, body.total)) return null;
  if (!isInt(body.max, 1, 100000) || !isInt(body.durationMs, 0, DAY_MS)) return null;
  if (!Array.isArray(body.ops) || body.ops.length < 1 || body.ops.length > OPS.length) return null;
  if (!body.ops.every(op => OPS.includes(op)) || new Set(body.ops).size !== body.ops.length) return null;
  // Mode and time limit are optional so pages loaded before they existed can still save
  const mode = body.mode ?? null;
  if (mode !== null && (typeof mode !== 'string' || !MODE_PATTERN.test(mode))) return null;
  const timeLimitMs = body.timeLimitMs ?? null;
  if (timeLimitMs !== null && (!TIME_LIMITS.includes(timeLimitMs) || body.durationMs > timeLimitMs + 5000)) return null;
  // The sums are optional too; when sent, they must match the score and the mode
  let problems = null;
  if (body.problems !== undefined) {
    problems = cleanProblems(body.problems, body.total);
    if (!problems || !problems.every(p => body.ops.includes(p.op))) return null;
    if (mode && !problems.every(p => fitsMode(p, mode))) return null;
    if (problems.filter(p => isCorrect(p, p.answer)).length !== body.right) return null;
  } else if (mode && mode !== 'mix') return null;
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
    mode,
    timeLimitMs,
  };
}

const parseProblems = text => { try { return text ? JSON.parse(text) : null; } catch { return null; } };
const COLUMNS = 'id, name, started_at, ended_at, ops, max_result, correct, total, country, user_id, problems, mode, time_limit_ms';
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
  mode: r.mode,
  timeLimitMs: r.time_limit_ms,
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

async function listMistakes(env, user) {
  const { results } = await env.DB.prepare('SELECT problems FROM attempts WHERE user_id = ? AND problems IS NOT NULL ORDER BY id DESC LIMIT 30').bind(user.id).all();
  return json({ problems: trickySums(results.map(r => parseProblems(r.problems))) });
}

async function readProgressRow(env, userId) {
  const row = await env.DB.prepare('SELECT data FROM user_progress WHERE user_id = ?').bind(userId).first();
  try { return cleanProgress(row ? JSON.parse(row.data) : null); } catch { return cleanProgress(null); }
}

async function progressRoute(request, env, user) {
  if (request.method === 'GET') return json({ progress: await readProgressRow(env, user.id) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' });
  sameOrigin(request);
  const body = await readBody(request);
  if (!body.progress || typeof body.progress !== 'object') return json({ error: 'Invalid progress' }, 400);
  const merged = mergeProgress(await readProgressRow(env, user.id), body.progress);
  await env.DB.prepare(
    `INSERT INTO user_progress (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).bind(user.id, JSON.stringify(merged), Date.now()).run();
  return json({ progress: merged });
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
    `INSERT INTO attempts (name, started_at, ended_at, ops, max_result, correct, total, country, user_id, problems, mode, time_limit_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(a.name, a.startedAt, a.endedAt, a.ops, a.max, a.right, a.total, country, user.id, a.problems && JSON.stringify(a.problems), a.mode, a.timeLimitMs).run();
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
  if (request.method === 'GET' && path === '/api/mistakes') return listMistakes(env, user);
  if (path === '/api/progress') return progressRoute(request, env, user);
  return authJson({ error: 'Not found.' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]', 'terminal.local'].includes(url.hostname)) {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 308);
    }
    try {
      if (url.pathname.startsWith('/api/auth/')) return await authRoute(request, env, url.pathname, ctx);
      if (url.pathname.startsWith('/api/')) return await apiRoute(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof HttpError) return authJson({ error: error.message }, error.status, error.status === 429 ? { 'Retry-After': '900' } : {});
      console.error(JSON.stringify({ event: 'api_failure', path: url.pathname }));
      return authJson({ error: 'Something went wrong. Please try again.' }, 500);
    }
  },
};
