import { applyD1Migrations, env } from 'cloudflare:test'
import { inject } from 'vitest'

const migrations = inject('d1Migrations')

await applyD1Migrations(env.DB, migrations)
