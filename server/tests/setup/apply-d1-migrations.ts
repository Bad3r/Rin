import { applyD1Migrations, env } from 'cloudflare:test'
import { inject } from 'vitest'

const migrations = inject('d1Migrations')

await applyD1Migrations(env.DB, migrations)

// Keep tests aligned with current schema definitions while legacy SQL migrations catch up.
try {
  await env.DB.prepare('ALTER TABLE feeds ADD COLUMN top INTEGER DEFAULT 0 NOT NULL').run()
} catch {
  // Column already exists in this test DB snapshot.
}
