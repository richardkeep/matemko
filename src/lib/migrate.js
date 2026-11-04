import { MIGRATIONS } from '../migrations.generated.js'
// Applies pending database migrations before the Worker serves its first API request,
// so newly deployed code never runs against an older schema.
//
// Uses the same d1_migrations table as `wrangler d1 migrations apply`, so either can be used.
// Each migration and its d1_migrations row are written in one batch, which D1 runs as a
// single transaction: a migration is applied completely or not at all.
//
// Migrations must stay backward compatible (add tables and columns, never drop or rename),
// because the previous version of the Worker keeps serving for a few moments during a deploy.

// Strips "--" comments and splits a migration into statements. Migrations must not put
// "--" or ";" inside string literals.
export function statements(sql) {
  return sql.split('\n').map(line => line.replace(/--.*$/, '')).join('\n').split(';').map(s => s.trim()).filter(Boolean)
}

export async function migrate(env, migrations = MIGRATIONS) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`).run()
  const { results } = await env.DB.prepare('SELECT name FROM d1_migrations').all()
  const applied = new Set(results.map(row => row.name))
  const ran = []
  for (const migration of migrations) {
    if (applied.has(migration.name)) continue
    try {
      await env.DB.batch([
        ...statements(migration.sql).map(sql => env.DB.prepare(sql)),
        env.DB.prepare('INSERT INTO d1_migrations (name) VALUES (?)').bind(migration.name),
      ])
      ran.push(migration.name)
    } catch (error) {
      // Another Worker instance may have applied it at the same moment
      const done = await env.DB.prepare('SELECT 1 AS done FROM d1_migrations WHERE name = ?').bind(migration.name).first()
      if (!done) throw error
    }
  }
  if (ran.length) console.log(JSON.stringify({ event: 'migrations_applied', migrations: ran }))
  return ran
}

// Checked once per Worker instance; a failure is retried on the next request.
const checked = new WeakMap()
export function ensureMigrated(env) {
  let pending = checked.get(env.DB)
  if (!pending) {
    pending = migrate(env).catch(error => { checked.delete(env.DB); throw error })
    checked.set(env.DB, pending)
  }
  return pending
}
