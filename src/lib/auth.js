import { sendMail, verificationMessage, resetMessage } from './mail.js'
const encoder = new TextEncoder()
export const SESSION_SECONDS = 7 * 24 * 60 * 60
export const COOKIE = '__Host-easymath_session'
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status } }
export const authJson = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } })
export const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('')
const randomHex = size => hex(crypto.getRandomValues(new Uint8Array(size)))
export const digest = async value => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
export function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.')
  return email
}
export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw new HttpError(400, 'Use a password between 10 and 128 characters.')
  return password
}
export function registration(body, today = new Date().toISOString().slice(0, 10)) {
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 1 || name.length > 80) throw new HttpError(400, 'Enter a name of up to 80 characters.')
  const email = normalizeEmail(body.email)
  const password = checkPassword(body.password)
  const dob = body.dateOfBirth
  if (typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob < '1900-01-01' || dob > today || !Number.isFinite(Date.parse(dob)) || new Date(dob).toISOString().slice(0, 10) !== dob) throw new HttpError(400, 'Enter a valid date of birth that is not in the future.')
  return { name, email, password, dob }
}
// Workers Web Crypto caps PBKDF2 at 100,000 iterations. Native crypto avoids JS hashing cost.
export async function hashPassword(password, salt = randomHex(16)) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256)
  return { salt, hash: hex(hash) }
}
export async function verifyPassword(password, salt, expected) {
  const actual = (await hashPassword(password, salt)).hash
  // Fixed-size digests, compared without an early exit.
  let mismatch = actual.length ^ expected.length
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ (expected.charCodeAt(i) || 0)
  return mismatch === 0
}
export async function readBody(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Send JSON data.')
  if (Number(request.headers.get('content-length')) > 8192) throw new HttpError(413, 'Request is too large.')
  const reader = request.body?.getReader(); if (!reader) throw new HttpError(400, 'Missing request data.')
  let size = 0; const chunks = []
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8192) { await reader.cancel(); throw new HttpError(413, 'Request is too large.') }; chunks.push(value) }
    const data = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength }
    const body = JSON.parse(new TextDecoder().decode(data)); if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error(); return body
  } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Invalid request data.') }
}
export function sameOrigin(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Please submit this form from Easy Math.')
}
// Platform admins are listed by email in the ADMIN_EMAILS variable (comma separated) and must
// have confirmed that email, so an unconfirmed sign-up can never gain admin access.
export function isAdmin(env, user) {
  if (!user?.emailVerified || typeof env?.ADMIN_EMAILS !== 'string') return false
  return env.ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase()).filter(Boolean).includes(user.email.toLowerCase())
}
const publicUser = (row, env) => {
  const user = { id: row.id, name: row.name, email: row.email, dateOfBirth: row.date_of_birth, emailVerified: Boolean(row.email_verified_at) }
  return { ...user, isAdmin: isAdmin(env, user) }
}
function cookieName(request) { return new URL(request.url).protocol === 'https:' ? COOKIE : 'easymath_local_session' }
function cookieValue(request, value, maxAge = SESSION_SECONDS) {
  return `${cookieName(request)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`
}
async function sessionHash(request) {
  const token = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(cookieName(request) + '='))?.split('=')[1]
  return token && /^[a-f0-9]{64}$/.test(token) ? digest(token) : null
}
export async function currentUser(request, env) {
  const hash = await sessionHash(request); if (!hash) return null
  const row = await env.DB.prepare('SELECT u.id, u.name, u.email, u.date_of_birth, u.email_verified_at FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').bind(hash, Date.now()).first()
  return row ? publicUser(row, env) : null
}
export async function limit(env, key, maximum, period) {
  const now = Date.now(); const keyHash = await digest(key)
  const row = await env.DB.prepare('INSERT INTO auth_limits (key_hash, hits, expires_at) VALUES (?, 1, ?) ON CONFLICT(key_hash) DO UPDATE SET hits = CASE WHEN expires_at <= ? THEN 1 ELSE hits + 1 END, expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING hits').bind(keyHash, now + period, now, now).first()
  if (row.hits > maximum) throw new HttpError(429, 'Too many attempts. Please try again later.')
}
const VERIFY_MS = 48 * 60 * 60 * 1000
const RESET_MS = 60 * 60 * 1000
const isDev = request => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)
// Email links carry the token in the URL fragment so it never reaches server logs or Referer headers.
const appLink = (request, key, token) => `${new URL(request.url).origin}/#${key}=${token}`
async function issueToken(env, userId, purpose, ttl) {
  const token = randomHex(32)
  await env.DB.batch([
    env.DB.prepare('DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?').bind(userId, purpose),
    env.DB.prepare('INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)').bind(await digest(token), userId, purpose, Date.now() + ttl),
  ])
  return token
}
// Single use: the row is deleted as it is read
async function consumeToken(env, token, purpose) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null
  const row = await env.DB.prepare('DELETE FROM auth_tokens WHERE token_hash = ? AND purpose = ? AND expires_at > ? RETURNING user_id').bind(await digest(token), purpose, Date.now()).first()
  return row?.user_id || null
}
// Runs mail delivery after the response when the runtime allows it, so timing does not reveal whether an email exists
async function background(ctx, task) {
  const safe = task.catch(() => console.error(JSON.stringify({ event: 'mail_failure' })))
  if (ctx?.waitUntil) ctx.waitUntil(safe); else await safe
}
async function sendVerification(request, env, user) {
  const token = await issueToken(env, user.id, 'verify', VERIFY_MS)
  return sendMail(env, verificationMessage(user.email, user.name, appLink(request, 'verify', token)), { dev: isDev(request) })
}
async function startSession(request, env, userId) {
  const token = randomHex(32)
  await env.DB.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await digest(token), userId, Date.now() + SESSION_SECONDS * 1000).run()
  return cookieValue(request, token)
}
const AUTH_POSTS = ['register', 'login', 'logout', 'forgot', 'reset', 'verify', 'resend-verification']
export async function authRoute(request, env, path, ctx) {
  if (path === '/api/auth/me' && request.method === 'GET') return authJson({ user: await currentUser(request, env) })
  const action = path.slice('/api/auth/'.length)
  if (!AUTH_POSTS.includes(action)) return authJson({ error: 'Not found.' }, 404)
  if (request.method !== 'POST') return authJson({ error: 'Method not allowed.' }, 405, { Allow: 'POST' })
  sameOrigin(request)
  if (action === 'logout') {
    const hash = await sessionHash(request); if (hash) await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(hash).run()
    return authJson({ ok: true }, 200, { 'Set-Cookie': cookieValue(request, '', 0) })
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'local'
  await limit(env, `auth-ip:${ip}`, 30, 15 * 60 * 1000)
  const now = Date.now()
  await env.DB.batch([env.DB.prepare('DELETE FROM auth_limits WHERE expires_at <= ?').bind(now), env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(now), env.DB.prepare('DELETE FROM auth_tokens WHERE expires_at <= ?').bind(now)])
  if (action === 'resend-verification') {
    const user = await currentUser(request, env)
    if (!user) throw new HttpError(401, 'Please sign in to continue.')
    if (user.emailVerified) return authJson({ ok: true, verified: true })
    await limit(env, `verify-send:${user.id}`, 3, 60 * 60 * 1000)
    return authJson({ ok: true, sent: await sendVerification(request, env, user) })
  }
  const body = await readBody(request)
  if (action === 'verify') {
    const userId = await consumeToken(env, body.token, 'verify')
    if (!userId) throw new HttpError(400, 'This link has expired or was already used. Sign in and ask for a new one.')
    await env.DB.prepare('UPDATE auth_users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?').bind(now, userId).run()
    return authJson({ ok: true })
  }
  if (action === 'reset') {
    const password = checkPassword(body.password)
    const userId = await consumeToken(env, body.token, 'reset')
    if (!userId) throw new HttpError(400, 'This reset link has expired or was already used. Please ask for a new one.')
    const hashed = await hashPassword(password)
    // A new password signs out every other device; proving access to the inbox also confirms the email.
    await env.DB.batch([
      env.DB.prepare('UPDATE auth_users SET password_hash = ?, password_salt = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?').bind(hashed.hash, hashed.salt, now, userId),
      env.DB.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?').bind(userId, 'reset'),
    ])
    const row = await env.DB.prepare('SELECT * FROM auth_users WHERE id = ?').bind(userId).first()
    return authJson({ user: publicUser(row, env) }, 200, { 'Set-Cookie': await startSession(request, env, userId) })
  }
  const email = normalizeEmail(body.email)
  if (action === 'forgot') {
    await limit(env, `reset-email:${email}`, 3, 60 * 60 * 1000)
    const row = await env.DB.prepare('SELECT id, name, email FROM auth_users WHERE email = ?').bind(email).first()
    if (row) await background(ctx, issueToken(env, row.id, 'reset', RESET_MS).then(token => sendMail(env, resetMessage(row.email, row.name, appLink(request, 'reset', token)), { dev: isDev(request) })))
    // The same answer whether or not the account exists
    return authJson({ ok: true })
  }
  await limit(env, `auth-email:${email}`, 10, 15 * 60 * 1000)
  let row
  if (action === 'register') {
    await limit(env, `signup:${ip}`, 5, 60 * 60 * 1000)
    const data = registration(body); const password = await hashPassword(data.password)
    row = { id: crypto.randomUUID(), name: data.name, email: data.email, date_of_birth: data.dob, email_verified_at: null }
    try { await env.DB.prepare('INSERT INTO auth_users (id, name, email, date_of_birth, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(row.id, row.name, row.email, row.date_of_birth, password.hash, password.salt, now).run() }
    catch (error) { if (/UNIQUE constraint failed.*email/i.test(error.message)) throw new HttpError(409, 'Unable to create this account. Try signing in or use a different email.'); throw error }
    await background(ctx, sendVerification(request, env, publicUser(row, env)))
  } else {
    if (typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 128) throw new HttpError(400, 'Enter your email and password.')
    row = await env.DB.prepare('SELECT * FROM auth_users WHERE email = ?').bind(email).first()
    // Always perform a password derivation, including unknown emails.
    const valid = await verifyPassword(body.password, row?.password_salt || '0'.repeat(32), row?.password_hash || '0'.repeat(64))
    if (!row || !valid) throw new HttpError(401, 'Email or password is incorrect.')
  }
  return authJson({ user: publicUser(row, env) }, action === 'register' ? 201 : 200, { 'Set-Cookie': await startSession(request, env, row.id) })
}
