import { authRoute, currentUser, HttpError, authJson, sameOrigin, readBody, isAdmin } from './lib/auth.js';
import { cleanProblems, isCorrect, trickySums, MODE_PATTERN, TIME_LIMITS } from './lib/worksheet.js';
import { mergeProgress } from './lib/progress.js';
import { familyRoute, readProgressRow } from './lib/family.js';
// Serves the Vue build from ./dist and a small API backed by D1.
//   GET  /api/attempts       -> each explorer's best round, best first (sums only for your own)
//   POST /api/attempts       -> record an attempt
//   GET  /api/attempts/mine  -> your own most recent rounds, with their sums
//   GET  /api/mistakes       -> sums you most recently got wrong or skipped
//   GET  /api/progress       -> your stars, stickers and streak
//   POST /api/progress       -> merge this device's progress into your account
//   /api/family/*            -> grown-ups following learners (see lib/family.js)
//   POST /api/presence       -> heartbeat: "I'm here, on this page"
//   GET  /api/admin/online   -> who is online and activity counts (platform admins only)
//   /api/auth/*              -> accounts (see lib/auth.js)

const OPS = ['+', '−', '×', '÷'];
const TOP_LIMIT = 100;
const MINE_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const ONLINE_MS = 2 * 60 * 1000; // heartbeats arrive about once a minute
const ACTIVITIES = ['practice', 'history', 'leaderboard', 'family', 'admin'];

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

// Star board order: best score, then most correct, then fastest, then newest
const RANKING = 'CAST(correct AS REAL) / total DESC, correct DESC, ended_at - started_at ASC, id DESC';

// One row per explorer: their best round. Rounds from before accounts existed have no
// user_id, so those are grouped by name. Everyone sees the scores; a round's sums are only
// returned to the account that played it.
async function listAttempts(env, user) {
  const { results } = await env.DB.prepare(
    `SELECT ${COLUMNS}
       FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY COALESCE(user_id, 'name:' || name) ORDER BY ${RANKING}) AS place
               FROM attempts)
      WHERE place = 1
      ORDER BY ${RANKING}
      LIMIT ?`
  ).bind(TOP_LIMIT).all();
  return json(results.map(r => ({ ...roundJson(r, r.user_id === user.id), mine: r.user_id === user.id })));
}

export async function roundsFor(env, userId, limit = MINE_LIMIT) {
  const { results } = await env.DB.prepare(`SELECT ${COLUMNS} FROM attempts WHERE user_id = ? ORDER BY id DESC LIMIT ?`).bind(userId, limit).all();
  return results.map(r => roundJson(r, true));
}

async function listMistakes(env, user) {
  const { results } = await env.DB.prepare('SELECT problems FROM attempts WHERE user_id = ? AND problems IS NOT NULL ORDER BY id DESC LIMIT 30').bind(user.id).all();
  return json({ problems: trickySums(results.map(r => parseProblems(r.problems))) });
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

const countryOf = request => {
  // Country comes from Cloudflare's IP lookup; XX = unknown, T1 = Tor
  const cc = request.cf?.country;
  return typeof cc === 'string' && /^[A-Z]{2}$/.test(cc) && cc !== 'XX' && cc !== 'T1' ? cc : null;
};

async function recordPresence(request, env, user) {
  const body = await readBody(request);
  if (!ACTIVITIES.includes(body.activity) || typeof body.inRound !== 'boolean') return json({ error: 'Invalid presence' }, 400);
  await env.DB.prepare(
    `INSERT INTO presence (user_id, last_seen, activity, in_round, country) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen, activity = excluded.activity, in_round = excluded.in_round, country = excluded.country`
  ).bind(user.id, Date.now(), body.activity, body.inRound ? 1 : 0, countryOf(request)).run();
  return json({ ok: true });
}

// Learners online now, plus simple activity counts. Email and birthday are never included.
async function adminOnline(env) {
  const now = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT u.name, p.last_seen, p.activity, p.in_round, p.country,
            (SELECT count(*) FROM attempts a WHERE a.user_id = u.id AND a.ended_at > ?) AS rounds_today
       FROM presence p JOIN auth_users u ON u.id = p.user_id
      WHERE p.last_seen > ?
      ORDER BY p.in_round DESC, p.last_seen DESC`
  ).bind(now - DAY_MS, now - ONLINE_MS).all();
  const counts = await env.DB.prepare(
    `SELECT (SELECT count(*) FROM presence WHERE last_seen > ?) AS active_today,
            (SELECT count(*) FROM presence WHERE last_seen > ?) AS active_week,
            (SELECT count(*) FROM auth_users) AS learners,
            (SELECT count(*) FROM attempts WHERE ended_at > ?) AS rounds_today`
  ).bind(now - DAY_MS, now - 7 * DAY_MS, now - DAY_MS).first();
  return json({
    now,
    onlineWindowMs: ONLINE_MS,
    online: results.map(r => ({ name: r.name, lastSeen: r.last_seen, activity: r.activity, inRound: Boolean(r.in_round), country: r.country, roundsToday: r.rounds_today })),
    counts: { online: results.length, activeToday: counts.active_today, activeWeek: counts.active_week, learners: counts.learners, roundsToday: counts.rounds_today },
  });
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
  const country = countryOf(request);
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
  if (path === '/api/presence' && request.method === 'POST') { sameOrigin(request); return recordPresence(request, env, user); }
  // Not found, rather than forbidden, so the admin API is invisible to everyone else
  if (path === '/api/admin/online' && request.method === 'GET') return isAdmin(env, user) ? adminOnline(env) : authJson({ error: 'Not found.' }, 404);
  if (path === '/api/family' || path.startsWith('/api/family/')) {
    if (request.method !== 'GET') sameOrigin(request);
    return familyRoute(request, env, path, user, roundsFor);
  }
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
