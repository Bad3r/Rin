#!/usr/bin/env bun
/**
 * Development environment bootstrap.
 * Loads values from .env.local and generates wrangler.toml + client/.env.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT_DIR = process.cwd()
const ENV_FILE = path.join(ROOT_DIR, '.env.local')

// Ensure .env.local exists.
if (!fs.existsSync(ENV_FILE)) {
  console.error('❌ Error: .env.local was not found')
  console.log('\nPlease run the following steps:')
  console.log('  1. cp .env.example .env.local')
  console.log('  2. Edit .env.local and fill in your configuration')
  console.log('  3. Re-run the dev command\n')
  process.exit(1)
}

// Parse .env.local.
function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // Skip comments and empty lines.
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalIndex = trimmed.indexOf('=')
    if (equalIndex > 0) {
      const key = trimmed.substring(0, equalIndex).trim()
      const value = trimmed.substring(equalIndex + 1).trim()
      env[key] = value
    }
  }

  return env
}

const envContent = fs.readFileSync(ENV_FILE, 'utf-8')
const env = parseEnv(envContent)

// Validate required environment variables.
const requiredVars = [
  'NAME',
  'AVATAR',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'RIN_GITHUB_CLIENT_ID',
  'RIN_GITHUB_CLIENT_SECRET',
  'JWT_SECRET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  // BACKEND_PORT and FRONTEND_PORT removed - now using unified port
]

const missingVars = requiredVars.filter(v => !env[v])
if (missingVars.length > 0) {
  console.error('❌ Error: The following required environment variables are missing:')
  missingVars.forEach(v => {
    console.error(`   - ${v}`)
  })
  console.log('\nPlease update .env.local with these values and try again.\n')
  process.exit(1)
}

// Generate wrangler.toml.
const wranglerContent = `#:schema node_modules/wrangler/config-schema.json
name = "${env.WORKER_NAME || 'rin-server'}"
main = "server/src/_worker.ts"
compatibility_date = "2025-03-21"

# Assets configuration - serves static files from ./dist/client
# For development, we use wrangler dev with ASSETS to serve both frontend and backend on same port
[assets]
directory = "./dist/client"
binding = "ASSETS"
# Worker handles all requests first, static assets served by Worker logic
run_worker_first = true
# SPA support - serve index.html for unmatched routes
not_found_handling = "single-page-application"

[triggers]
crons = ["*/20 * * * *"]

[vars]
S3_FOLDER = "${env.S3_FOLDER || 'images/'}"
S3_CACHE_FOLDER = "${env.S3_CACHE_FOLDER || 'cache/'}"
S3_REGION = "${env.S3_REGION || 'auto'}"
S3_ENDPOINT = "${env.S3_ENDPOINT}"
S3_ACCESS_HOST = "${env.S3_ACCESS_HOST || env.S3_ENDPOINT}"
S3_BUCKET = "${env.S3_BUCKET}"
S3_FORCE_PATH_STYLE = "${env.S3_FORCE_PATH_STYLE || 'false'}"
WEBHOOK_URL = "${env.WEBHOOK_URL || ''}"
RSS_TITLE = "${env.RSS_TITLE || 'Rin Development'}"
RSS_DESCRIPTION = "${env.RSS_DESCRIPTION || 'Development Environment'}"
CACHE_STORAGE_MODE = "${env.CACHE_STORAGE_MODE || 's3'}"
ADMIN_USERNAME = "${env.ADMIN_USERNAME}"
ADMIN_PASSWORD = "${env.ADMIN_PASSWORD}"

[[d1_databases]]
binding = "DB"
database_name = "${env.DB_NAME || 'rin'}"
database_id = "local"
`

fs.writeFileSync(path.join(ROOT_DIR, 'wrangler.toml'), wranglerContent)
console.log('✅ Generated wrangler.toml')

// Generate client/.env.
const clientEnvContent = `NAME=${env.NAME}
DESCRIPTION=${env.DESCRIPTION || ''}
AVATAR=${env.AVATAR}
PAGE_SIZE=${env.PAGE_SIZE || '5'}
RSS_ENABLE=${env.RSS_ENABLE || 'false'}
`

fs.writeFileSync(path.join(ROOT_DIR, 'client', '.env'), clientEnvContent)
console.log('✅ Generated client/.env')

// Generate .dev.vars for Wrangler secrets.
const devVarsContent = `RIN_GITHUB_CLIENT_ID=${env.RIN_GITHUB_CLIENT_ID}
RIN_GITHUB_CLIENT_SECRET=${env.RIN_GITHUB_CLIENT_SECRET}
JWT_SECRET=${env.JWT_SECRET}
S3_ACCESS_KEY_ID=${env.S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${env.S3_SECRET_ACCESS_KEY}
`

fs.writeFileSync(path.join(ROOT_DIR, '.dev.vars'), devVarsContent)
console.log('✅ Generated .dev.vars')

console.log('\n🎉 Development configuration loaded successfully.')
console.log('   You can now run: bun run dev\n')
