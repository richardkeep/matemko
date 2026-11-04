import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import worker from '../src/worker.js'
import { registration, hashPassword, verifyPassword, COOKIE } from '../src/lib/auth.js'
function database() {
  const sqlite = new DatabaseSync(':memory:')
  for (const f of readdirSync(new URL('../migrations/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'))
  const DB = { prepare(sql) { const statement = sqlite.prepare(sql); let args = []; return { bind(...values) { args = values; return this }, async first() { return statement.get(...args) || null }, async all() { return { results: statement.all(...args) } }, async run() { statement.run(...args); return { success: true } } } }, async batch(statements) { const results = []; for (const s of statements) results.push(await s.run()); return results } }
  return { DB, sqlite, ASSETS: { fetch: () => new Response('app') } }
}
const fields = { name: 'Test Explorer', email: 'explorer@example.test', password: 'Long-test-password-7!', dateOfBirth: '2016-05-14' }
function request(path, body, cookie, origin = 'https://maths.example.test') {
  return new Request('https://maths.example.test' + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: origin }), ...(cookie ? { Cookie: cookie } : {}), 'CF-Connecting-IP': '192.0.2.1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}
const call = (env, path, body, cookie, origin) => worker.fetch(request(path, body, cookie, origin), env)
const cookie = r => r.headers.get('set-cookie').split(';')[0]
test('registration validates real dates, names, email and password boundaries', () => {
  assert.equal(registration({ ...fields, email: ' Explorer@Example.test ' }).email, 'explorer@example.test')
  for (const changed of [{ dateOfBirth: '2025-02-29' }, { dateOfBirth: '2099-01-01' }, { dateOfBirth: '2016-13-01' }, { name: ' ' }, { email: 'nope' }, { password: 'short' }, { password: 'x'.repeat(129) }]) assert.throws(() => registration({ ...fields, ...changed }))
})
test('passwords have independent salts and only the correct password verifies', async () => {
  const a = await hashPassword(fields.password); const b = await hashPassword(fields.password)
  assert.notEqual(a.salt, b.salt); assert.notEqual(a.hash, b.hash)
  assert.equal(await verifyPassword(fields.password, a.salt, a.hash), true)
  assert.equal(await verifyPassword('incorrect-password', a.salt, a.hash), false)
})
test('account lifecycle protects sessions, private fields, scores and sign-out', async () => {
  const env = database()
  try {
    assert.equal((await call(env, '/api/attempts')).status, 401)
    const r = await call(env, '/api/auth/register', fields); assert.equal(r.status, 201)
    const body = await r.json(); const session = cookie(r)
    assert.match(session, new RegExp('^' + COOKIE + '=')); assert.match(r.headers.get('set-cookie'), /HttpOnly/); assert.match(r.headers.get('set-cookie'), /Secure/); assert.match(r.headers.get('set-cookie'), /SameSite=Lax/)
    assert.equal(body.user.email, fields.email); assert.equal(body.user.dateOfBirth, fields.dateOfBirth); assert.equal(body.user.password_hash, undefined)
    const stored = env.sqlite.prepare('SELECT * FROM auth_users').get(); assert.notEqual(stored.password_hash, fields.password)
    const token = session.split('=')[1]; assert.notEqual(env.sqlite.prepare('SELECT token_hash FROM auth_sessions').get().token_hash, token)
    assert.equal((await (await call(env, '/api/auth/me', undefined, session)).json()).user.id, body.user.id)
    const attempt = { name: 'Captain Clever', total: 5, right: 4, max: 10, ops: ['+'], durationMs: 1000, user_id: 'forged' }
    assert.equal((await call(env, '/api/attempts', attempt, session)).status, 201)
    assert.equal(env.sqlite.prepare('SELECT user_id FROM attempts').get().user_id, body.user.id)
    const board = await (await call(env, '/api/attempts', undefined, session)).json(); assert.equal(board[0].name, fields.name); assert.equal(JSON.stringify(board).includes(fields.email), false); assert.equal(JSON.stringify(board).includes(fields.dateOfBirth), false)
    assert.equal((await call(env, '/api/auth/register', fields)).status, 409)
    const bad = await call(env, '/api/auth/login', { email: fields.email, password: 'bad' }); const missing = await call(env, '/api/auth/login', { email: 'missing@example.test', password: 'bad' }); assert.equal(bad.status, 401); assert.deepEqual(await bad.json(), await missing.json())
    const login = await call(env, '/api/auth/login', { email: fields.email.toUpperCase(), password: fields.password }); assert.equal(login.status, 200)
    const loggedOut = await call(env, '/api/auth/logout', {}, session); assert.match(loggedOut.headers.get('set-cookie'), /Max-Age=0/); assert.equal((await call(env, '/api/attempts', undefined, session)).status, 401)
    const expired = cookie(login); env.sqlite.exec('UPDATE auth_sessions SET expires_at = 0'); assert.equal((await (await call(env, '/api/auth/me', undefined, expired)).json()).user, null)
    assert.equal((await (await call(env, '/api/auth/me', undefined, COOKIE + '=forged')).json()).user, null)
  } finally { env.sqlite.close() }
})
test('cross-origin, oversized requests and repeated login attempts are rejected', async () => {
  const env = database()
  try {
    assert.equal((await call(env, '/api/auth/register', fields, null, 'https://evil.example')).status, 403)
    assert.equal((await call(env, '/api/auth/register', { ...fields, extra: 'a'.repeat(9000) })).status, 413)
    for (let i = 0; i < 10; i++) assert.equal((await call(env, '/api/auth/login', { email: fields.email, password: 'bad' })).status, 401)
    assert.equal((await call(env, '/api/auth/login', { email: fields.email, password: 'bad' })).status, 429)
  } finally { env.sqlite.close() }
})

test('production HTTP redirects to HTTPS before processing credentials', async () => {
  const r = await worker.fetch(new Request('http://maths.example.test/api/auth/register', { method: 'POST' }), {});
  assert.equal(r.status, 308); assert.equal(r.headers.get('location'), 'https://maths.example.test/api/auth/register');
})

test('a round\'s sums are saved, must match the score, and are only returned to the account that played it', async () => {
  const env = database()
  try {
    const owner = cookie(await call(env, '/api/auth/register', fields))
    const other = cookie(await call(env, '/api/auth/register', { ...fields, name: 'Other Explorer', email: 'other@example.test' }))
    const problems = [{ a: 48, op: '+', b: 1, c: 49, hide: 'b', answer: '1' }, { a: 43, op: '−', b: 24, c: 19, hide: 'c', answer: '20' }]
    const attempt = { total: 2, right: 1, max: 50, ops: ['+', '−'], durationMs: 1000, problems }
    assert.equal((await call(env, '/api/attempts', { ...attempt, right: 2 }, owner)).status, 400)
    assert.equal((await call(env, '/api/attempts', attempt, owner)).status, 201)
    const mine = (await (await call(env, '/api/attempts', undefined, owner)).json())[0]
    assert.equal(mine.mine, true); assert.deepEqual(mine.problems, problems)
    const theirs = (await (await call(env, '/api/attempts', undefined, other)).json())[0]
    assert.equal(theirs.mine, false); assert.equal(theirs.problems, null); assert.equal(theirs.right, 1)
  } finally { env.sqlite.close() }
})

const outbox = env => { const sent = []; env.MAILER = { send: message => { sent.push(message) } }; return sent }
const tokenIn = (message, kind) => new RegExp(`#${kind}=([a-f0-9]{64})`).exec(message.text)[1]

test('sign-up sends a single-use verification link that confirms the email', async () => {
  const env = database(); const sent = outbox(env)
  try {
    const r = await call(env, '/api/auth/register', fields); const session = cookie(r)
    assert.equal((await r.json()).user.emailVerified, false)
    assert.equal(sent.length, 1); assert.equal(sent[0].to, fields.email); assert.match(sent[0].text, /^.*https:\/\/maths\.example\.test\/#verify=/m)
    const token = tokenIn(sent[0], 'verify')
    assert.equal(env.sqlite.prepare('SELECT token_hash FROM auth_tokens').get().token_hash === token, false)
    assert.equal((await call(env, '/api/auth/verify', { token: 'f'.repeat(64) })).status, 400)
    assert.equal((await call(env, '/api/auth/verify', { token })).status, 200)
    assert.equal((await call(env, '/api/auth/verify', { token })).status, 400)
    assert.equal((await (await call(env, '/api/auth/me', undefined, session)).json()).user.emailVerified, true)
    assert.equal((await (await call(env, '/api/auth/resend-verification', {}, session)).json()).verified, true)
    assert.equal(sent.length, 1)
  } finally { env.sqlite.close() }
})

test('verification links can be resent a few times, and an old link stops working', async () => {
  const env = database(); const sent = outbox(env)
  try {
    const session = cookie(await call(env, '/api/auth/register', fields))
    assert.equal((await call(env, '/api/auth/resend-verification', {})).status, 401)
    for (let i = 0; i < 3; i++) assert.equal((await (await call(env, '/api/auth/resend-verification', {}, session)).json()).sent, true)
    assert.equal((await call(env, '/api/auth/resend-verification', {}, session)).status, 429)
    assert.equal((await call(env, '/api/auth/verify', { token: tokenIn(sent[0], 'verify') })).status, 400)
    assert.equal((await call(env, '/api/auth/verify', { token: tokenIn(sent.at(-1), 'verify') })).status, 200)
  } finally { env.sqlite.close() }
})

test('password reset answers the same for unknown emails, works once, expires and signs out other devices', async () => {
  const env = database(); const sent = outbox(env)
  try {
    const oldSession = cookie(await call(env, '/api/auth/register', fields)); sent.length = 0
    const unknown = await call(env, '/api/auth/forgot', { email: 'nobody@example.test' })
    const known = await call(env, '/api/auth/forgot', { email: fields.email.toUpperCase() })
    assert.equal(unknown.status, 200); assert.deepEqual(await unknown.json(), await known.json())
    assert.equal(sent.length, 1); assert.equal(sent[0].to, fields.email)
    const token = tokenIn(sent[0], 'reset')
    assert.equal((await call(env, '/api/auth/reset', { token, password: 'short' })).status, 400)
    const reset = await call(env, '/api/auth/reset', { token, password: 'A-brand-new-password' })
    assert.equal(reset.status, 200); const body = await reset.json(); assert.equal(body.user.emailVerified, true)
    assert.equal((await (await call(env, '/api/auth/me', undefined, oldSession)).json()).user, null)
    assert.equal((await (await call(env, '/api/auth/me', undefined, cookie(reset))).json()).user.id, body.user.id)
    assert.equal((await call(env, '/api/auth/reset', { token, password: 'Another-new-password' })).status, 400)
    assert.equal((await call(env, '/api/auth/login', { email: fields.email, password: fields.password })).status, 401)
    assert.equal((await call(env, '/api/auth/login', { email: fields.email, password: 'A-brand-new-password' })).status, 200)
    await call(env, '/api/auth/forgot', { email: fields.email }); env.sqlite.exec('UPDATE auth_tokens SET expires_at = 1')
    assert.equal((await call(env, '/api/auth/reset', { token: tokenIn(sent.at(-1), 'reset'), password: 'Expired-link-password' })).status, 400)
    await call(env, '/api/auth/forgot', { email: fields.email })
    assert.equal((await call(env, '/api/auth/forgot', { email: fields.email })).status, 429)
  } finally { env.sqlite.close() }
})

test('my rounds include every round I played with sums, and tricky sums come from my latest misses', async () => {
  const env = database()
  try {
    const me = cookie(await call(env, '/api/auth/register', fields))
    const other = cookie(await call(env, '/api/auth/register', { ...fields, name: 'Other', email: 'other@example.test' }))
    const p = (a, answer) => ({ a, op: '+', b: 1, c: a + 1, hide: 'c', answer })
    const round = problems => ({ total: problems.length, right: problems.filter(x => x.answer === String(x.c)).length, max: 20, ops: ['+'], durationMs: 1000, problems, mode: 'mix' })
    assert.equal((await call(env, '/api/attempts', round([p(1, '0'), p(2, '')]), me)).status, 201)
    assert.equal((await call(env, '/api/attempts', round([p(1, '2'), p(5, '6')]), me)).status, 201)
    assert.equal((await call(env, '/api/attempts', round([p(9, '0')]), other)).status, 201)
    const mine = await (await call(env, '/api/attempts/mine', undefined, me)).json()
    assert.equal(mine.length, 2); assert.equal(mine[0].problems[1].a, 5); assert.equal(mine[0].mode, 'mix')
    assert.deepEqual((await (await call(env, '/api/mistakes', undefined, me)).json()).problems, [{ a: 2, op: '+', b: 1, c: 3, hide: 'c' }])
    assert.equal((await call(env, '/api/attempts/mine')).status, 401)
  } finally { env.sqlite.close() }
})

test('round modes and timers are validated against the sums', async () => {
  const env = database()
  try {
    const me = cookie(await call(env, '/api/auth/register', fields))
    const table = [{ a: 7, op: '×', b: 3, c: 21, hide: 'c', answer: '21' }]
    const base = { total: 1, right: 1, max: 84, ops: ['×'], durationMs: 30000, problems: table }
    assert.equal((await call(env, '/api/attempts', { ...base, mode: 'table-7', timeLimitMs: 60000 }, me)).status, 201)
    assert.equal((await call(env, '/api/attempts', { ...base, mode: 'table-8' }, me)).status, 400)
    assert.equal((await call(env, '/api/attempts', { ...base, mode: 'table-99' }, me)).status, 400)
    assert.equal((await call(env, '/api/attempts', { ...base, mode: 'table-7', timeLimitMs: 45000 }, me)).status, 400)
    assert.equal((await call(env, '/api/attempts', { ...base, mode: 'table-7', timeLimitMs: 60000, durationMs: 90000 }, me)).status, 400)
    for (const minutes of [4, 5, 10, 15, 20, 30]) assert.equal((await call(env, '/api/attempts', { ...base, mode: 'table-7', timeLimitMs: minutes * 60000, durationMs: minutes * 60000 }, me)).status, 201, `${minutes} minutes`)
    for (const minutes of [6, 25, 31, 60]) assert.equal((await call(env, '/api/attempts', { ...base, mode: 'table-7', timeLimitMs: minutes * 60000 }, me)).status, 400, `${minutes} minutes`)
    const bonds = [{ a: 4, op: '+', b: 6, c: 10, hide: 'a', answer: '4' }, { a: 10, op: '−', b: 3, c: 7, hide: 'c', answer: '' }]
    assert.equal((await call(env, '/api/attempts', { total: 2, right: 1, max: 10, ops: ['+', '−'], durationMs: 1000, problems: bonds, mode: 'bonds-10' }, me)).status, 201)
    assert.equal((await call(env, '/api/attempts', { total: 2, right: 1, max: 20, ops: ['+', '−'], durationMs: 1000, problems: bonds, mode: 'bonds-20' }, me)).status, 400)
    const mine = await (await call(env, '/api/attempts/mine', undefined, me)).json()
    assert.deepEqual(mine.map(r => [r.mode, r.timeLimitMs]).filter(r => r[1] !== null && r[1] > 60000).length, 6)
    assert.deepEqual(mine.filter(r => r.timeLimitMs === null || r.timeLimitMs === 60000).map(r => [r.mode, r.timeLimitMs]).sort(), [['bonds-10', null], ['table-7', 60000]])
    const board = await (await call(env, '/api/attempts', undefined, me)).json()
    assert.deepEqual(board.map(r => [r.mode, r.timeLimitMs]), [['table-7', 60000]])
  } finally { env.sqlite.close() }
})

test('progress syncs across devices by merging, per account', async () => {
  const env = database()
  try {
    const me = cookie(await call(env, '/api/auth/register', fields))
    const other = cookie(await call(env, '/api/auth/register', { ...fields, email: 'other@example.test' }))
    assert.equal((await (await call(env, '/api/progress', undefined, me)).json()).progress.rounds, 0)
    await call(env, '/api/progress', { progress: { rounds: 5, stars: 10, lastDay: '2026-11-03', streak: 2, bestStreak: 2, dailyStars: 3 } }, me)
    const merged = (await (await call(env, '/api/progress', { progress: { rounds: 2, stars: 4, lastDay: '2026-11-04', streak: 3, dailyStars: 1, hacked: true } }, me)).json()).progress
    assert.equal(merged.rounds, 5); assert.equal(merged.stars, 10); assert.equal(merged.lastDay, '2026-11-04'); assert.equal(merged.streak, 3); assert.equal(merged.bestStreak, 3); assert.equal(merged.hacked, undefined)
    assert.equal((await (await call(env, '/api/progress', undefined, other)).json()).progress.rounds, 0)
    assert.equal((await call(env, '/api/progress', { progress: {} }, me, 'https://evil.example')).status, 403)
  } finally { env.sqlite.close() }
})

test('grown-ups follow a learner with a single-use code and see rounds but not private details', async () => {
  const env = database()
  try {
    const child = cookie(await call(env, '/api/auth/register', { ...fields, name: 'Little Explorer', email: 'kid@example.test' }))
    const parent = cookie(await call(env, '/api/auth/register', { ...fields, name: 'Grown Up', email: 'parent@example.test' }))
    const stranger = cookie(await call(env, '/api/auth/register', { ...fields, name: 'Stranger', email: 'stranger@example.test' }))
    await call(env, '/api/attempts', { total: 1, right: 1, max: 10, ops: ['+'], durationMs: 1000, problems: [{ a: 1, op: '+', b: 1, c: 2, hide: 'c', answer: '2' }] }, child)
    await call(env, '/api/progress', { progress: { rounds: 1, stars: 3 } }, child)
    const { code } = await (await call(env, '/api/family/code', {}, child)).json()
    assert.match(code, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/)
    assert.equal(env.sqlite.prepare('SELECT code_hash FROM guardian_codes').get().code_hash.includes(code.replace('-', '')), false)
    assert.equal((await call(env, '/api/family/link', { code }, child)).status, 400)
    const { code: fresh } = await (await call(env, '/api/family/code', {}, child)).json()
    assert.equal((await call(env, '/api/family/link', { code }, parent)).status, 400)
    assert.equal((await call(env, '/api/family/link', { code: fresh.toLowerCase().replace('-', ' ') }, parent)).status, 201)
    assert.equal((await call(env, '/api/family/link', { code: fresh }, stranger)).status, 400)
    const view = await (await call(env, '/api/family', undefined, parent)).json()
    assert.equal(view.children.length, 1); assert.equal(view.children[0].name, 'Little Explorer'); assert.equal(view.children[0].progress.stars, 3)
    assert.equal(view.children[0].rounds[0].problems[0].answer, '2')
    assert.equal(JSON.stringify(view).includes('kid@example.test'), false); assert.equal(JSON.stringify(view).includes(fields.dateOfBirth), false)
    assert.deepEqual((await (await call(env, '/api/family', undefined, child)).json()).guardians.map(g => g.name), ['Grown Up'])
    assert.equal((await (await call(env, '/api/family', undefined, stranger)).json()).children.length, 0)
    assert.equal((await call(env, '/api/family/code', {}, child, 'https://evil.example')).status, 403)
    const childId = view.children[0].id
    assert.equal((await call(env, '/api/family/unlink', { id: (await (await call(env, '/api/auth/me', undefined, parent)).json()).user.id }, child)).status, 200)
    assert.equal((await (await call(env, '/api/family', undefined, parent)).json()).children.length, 0)
    assert.ok(childId)
  } finally { env.sqlite.close() }
})

test('the star board shows only each explorer\'s best round', async () => {
  const env = database()
  try {
    const ada = cookie(await call(env, '/api/auth/register', { ...fields, name: 'Ada', email: 'ada@example.test' }))
    const ben = cookie(await call(env, '/api/auth/register', { ...fields, name: 'Ben', email: 'ben@example.test' }))
    const round = (right, durationMs, total = 10) => ({ total, right, max: 20, ops: ['+'], durationMs })
    for (const r of [round(6, 1000), round(9, 9000), round(9, 5000), round(4, 1000)]) assert.equal((await call(env, '/api/attempts', r, ada)).status, 201)
    for (const r of [round(8, 2000), round(10, 30000, 20)]) assert.equal((await call(env, '/api/attempts', r, ben)).status, 201)
    env.sqlite.exec("INSERT INTO attempts (name, started_at, ended_at, ops, max_result, correct, total) VALUES ('Old Timer', 0, 1000, '+', 10, 3, 5), ('Old Timer', 0, 1000, '+', 10, 5, 5)")
    const board = await (await call(env, '/api/attempts', undefined, ada)).json()
    assert.deepEqual(board.map(r => [r.name, r.right, r.total, r.endedAt - r.startedAt]), [['Old Timer', 5, 5, 1000], ['Ada', 9, 10, 5000], ['Ben', 8, 10, 2000]])
    assert.deepEqual(board.map(r => r.mine), [false, true, false])
    assert.equal((await (await call(env, '/api/attempts/mine', undefined, ada)).json()).length, 4)
  } finally { env.sqlite.close() }
})
