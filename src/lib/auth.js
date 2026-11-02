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
export function registration(body, today = new Date().toISOString().slice(0, 10)) {
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 1 || name.length > 80) throw new HttpError(400, 'Enter a name of up to 80 characters.')
  const email = normalizeEmail(body.email)
  const password = body.password
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw new HttpError(400, 'Use a password between 10 and 128 characters.')
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
const publicUser = row => ({ id: row.id, name: row.name, email: row.email, dateOfBirth: row.date_of_birth })
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
  const row = await env.DB.prepare('SELECT u.id, u.name, u.email, u.date_of_birth FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').bind(hash, Date.now()).first()
  return row ? publicUser(row) : null
}
async function limit(env, key, maximum, period) {
  const now = Date.now(); const keyHash = await digest(key)
  const row = await env.DB.prepare('INSERT INTO auth_limits (key_hash, hits, expires_at) VALUES (?, 1, ?) ON CONFLICT(key_hash) DO UPDATE SET hits = CASE WHEN expires_at <= ? THEN 1 ELSE hits + 1 END, expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING hits').bind(keyHash, now + period, now, now).first()
  if (row.hits > maximum) throw new HttpError(429, 'Too many attempts. Please try again later.')
}
export async function authRoute(request, env, path) {
  if (path === '/api/auth/me' && request.method === 'GET') return authJson({ user: await currentUser(request, env) })
  if (!['/api/auth/register', '/api/auth/login', '/api/auth/logout'].includes(path)) return authJson({ error: 'Not found.' }, 404)
  if (request.method !== 'POST') return authJson({ error: 'Method not allowed.' }, 405, { Allow: 'POST' })
  sameOrigin(request)
  if (path.endsWith('/logout')) {
    const hash = await sessionHash(request); if (hash) await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(hash).run()
    return authJson({ ok: true }, 200, { 'Set-Cookie': cookieValue(request, '', 0) })
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'local'
  await limit(env, `auth-ip:${ip}`, 30, 15 * 60 * 1000)
  const body = await readBody(request)
  const email = normalizeEmail(body.email)
  await limit(env, `auth-email:${email}`, 10, 15 * 60 * 1000)
  await env.DB.batch([env.DB.prepare('DELETE FROM auth_limits WHERE expires_at <= ?').bind(Date.now()), env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(Date.now())])
  let row
  if (path.endsWith('/register')) {
    await limit(env, `signup:${ip}`, 5, 60 * 60 * 1000)
    const data = registration(body); const password = await hashPassword(data.password)
    row = { id: crypto.randomUUID(), name: data.name, email: data.email, date_of_birth: data.dob }
    try { await env.DB.prepare('INSERT INTO auth_users (id, name, email, date_of_birth, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(row.id, row.name, row.email, row.date_of_birth, password.hash, password.salt, Date.now()).run() }
    catch (error) { if (/UNIQUE constraint failed.*email/i.test(error.message)) throw new HttpError(409, 'Unable to create this account. Try signing in or use a different email.'); throw error }
  } else {
    if (typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 128) throw new HttpError(400, 'Enter your email and password.')
    row = await env.DB.prepare('SELECT * FROM auth_users WHERE email = ?').bind(email).first()
    // Always perform a password derivation, including unknown emails.
    const valid = await verifyPassword(body.password, row?.password_salt || '0'.repeat(32), row?.password_hash || '0'.repeat(64))
    if (!row || !valid) throw new HttpError(401, 'Email or password is incorrect.')
  }
  const token = randomHex(32)
  await env.DB.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await digest(token), row.id, Date.now() + SESSION_SECONDS * 1000).run()
  return authJson({ user: publicUser(row) }, path.endsWith('/register') ? 201 : 200, { 'Set-Cookie': cookieValue(request, token) })
}
