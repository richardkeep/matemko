import { HttpError, authJson, digest, limit, readBody } from './auth.js'
import { cleanProgress } from './progress.js'
// A learner shares a short, single-use code; a grown-up enters it to follow that learner's rounds.
// Grown-ups see the learner's name, rounds, sums and progress, never their email or birthday.
// Either side can remove the link at any time.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O, 1/I/L
const CODE_MS = 24 * 60 * 60 * 1000
const normalizeCode = value => typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
function newCode() {
  let code = ''
  while (code.length < 8) for (const byte of crypto.getRandomValues(new Uint8Array(16))) if (byte < 248 && code.length < 8) code += ALPHABET[byte % ALPHABET.length]
  return code
}
export async function readProgressRow(env, userId) {
  const row = await env.DB.prepare('SELECT data FROM user_progress WHERE user_id = ?').bind(userId).first()
  try { return cleanProgress(row ? JSON.parse(row.data) : null) } catch { return cleanProgress(null) }
}
export async function familyRoute(request, env, path, user, roundsFor) {
  if (path === '/api/family' && request.method === 'GET') {
    const { results: children } = await env.DB.prepare('SELECT u.id, u.name FROM guardian_links g JOIN auth_users u ON u.id = g.child_id WHERE g.guardian_id = ? ORDER BY g.created_at').bind(user.id).all()
    const { results: guardians } = await env.DB.prepare('SELECT u.id, u.name FROM guardian_links g JOIN auth_users u ON u.id = g.guardian_id WHERE g.child_id = ? ORDER BY g.created_at').bind(user.id).all()
    const detailed = []
    for (const child of children) detailed.push({ id: child.id, name: child.name, progress: await readProgressRow(env, child.id), rounds: await roundsFor(env, child.id, 20) })
    return authJson({ children: detailed, guardians: guardians.map(g => ({ id: g.id, name: g.name })) })
  }
  if (request.method !== 'POST') return authJson({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' })
  if (path === '/api/family/code') {
    await limit(env, `family-code:${user.id}`, 10, 60 * 60 * 1000)
    const code = newCode(); const expiresAt = Date.now() + CODE_MS
    await env.DB.batch([
      env.DB.prepare('DELETE FROM guardian_codes WHERE child_id = ? OR expires_at <= ?').bind(user.id, Date.now()),
      env.DB.prepare('INSERT INTO guardian_codes (code_hash, child_id, expires_at) VALUES (?, ?, ?)').bind(await digest(code), user.id, expiresAt),
    ])
    return authJson({ code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt })
  }
  const body = await readBody(request)
  if (path === '/api/family/link') {
    await limit(env, `family-link:${user.id}`, 10, 15 * 60 * 1000)
    const code = normalizeCode(body.code)
    if (code.length !== 8) throw new HttpError(400, 'Enter the 8-character code from the explorer’s Family page.')
    const row = await env.DB.prepare('DELETE FROM guardian_codes WHERE code_hash = ? AND expires_at > ? RETURNING child_id').bind(await digest(code), Date.now()).first()
    if (!row) throw new HttpError(400, 'That code did not work. It may have expired — ask for a new one.')
    if (row.child_id === user.id) throw new HttpError(400, 'That is your own code. Share it with a grown-up instead.')
    await env.DB.prepare('INSERT OR IGNORE INTO guardian_links (guardian_id, child_id, created_at) VALUES (?, ?, ?)').bind(user.id, row.child_id, Date.now()).run()
    return authJson({ ok: true }, 201)
  }
  if (path === '/api/family/unlink') {
    if (typeof body.id !== 'string' || body.id.length > 64) throw new HttpError(400, 'Choose who to remove.')
    await env.DB.prepare('DELETE FROM guardian_links WHERE (guardian_id = ? AND child_id = ?) OR (child_id = ? AND guardian_id = ?)').bind(user.id, body.id, user.id, body.id).run()
    return authJson({ ok: true })
  }
  return authJson({ error: 'Not found.' }, 404)
}
