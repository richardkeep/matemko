import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import worker from '../src/worker.js'
import { registration, hashPassword, verifyPassword, COOKIE } from '../src/lib/auth.js'
function database() {
  const sqlite = new DatabaseSync(':memory:')
  for (const f of ['0001_create_attempts.sql', '0002_add_country.sql', '0003_authentication.sql']) sqlite.exec(readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'))
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
    const board = await (await call(env, '/api/attempts', undefined, session)).json(); assert.equal(board[0].name, 'Captain Clever'); assert.equal(JSON.stringify(board).includes(fields.email), false); assert.equal(JSON.stringify(board).includes(fields.dateOfBirth), false)
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
