import { applyD1Migrations, env } from 'cloudflare:test'
import { inject } from 'vitest'

const migrations = inject('d1Migrations')

// Setup files run outside per-test isolated storage.
// Applying migrations here establishes the schema baseline snapshot used by isolated tests.
await applyD1Migrations(env.DB, migrations)
