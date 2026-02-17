#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs'
import { $ } from 'bun'

function readSecret(path: string): string {
  try {
    if (!existsSync(path)) return ''
    return readFileSync(path, 'utf8').trim()
  } catch {
    return ''
  }
}

function firstValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value.trim()
    }
  }
  return ''
}

async function main() {
  const accountId = firstValue(process.env.CLOUDFLARE_ACCOUNT_ID, readSecret('/run/secrets/r2/account-id'))
  const apiToken = firstValue(process.env.CLOUDFLARE_API_TOKEN)
  const s3AccessKeyId = firstValue(process.env.S3_ACCESS_KEY_ID, readSecret('/run/secrets/r2/access-key-id'))
  const s3SecretAccessKey = firstValue(
    process.env.S3_SECRET_ACCESS_KEY,
    readSecret('/run/secrets/r2/secret-access-key')
  )

  const missing: string[] = []
  if (!apiToken) missing.push('CLOUDFLARE_API_TOKEN')
  if (!accountId) missing.push('CLOUDFLARE_ACCOUNT_ID (or /run/secrets/r2/account-id)')
  if (!s3AccessKeyId) missing.push('S3_ACCESS_KEY_ID (or /run/secrets/r2/access-key-id)')
  if (!s3SecretAccessKey) missing.push('S3_SECRET_ACCESS_KEY (or /run/secrets/r2/secret-access-key)')

  const wranglerVersion = await $`bunx wrangler --version`.nothrow().quiet()
  if (wranglerVersion.exitCode !== 0) {
    missing.push('wrangler CLI (bunx wrangler --version failed)')
  }

  if (missing.length > 0) {
    console.error('❌ Cloudflare preflight failed. Missing requirements:')
    for (const key of missing) {
      console.error(`  - ${key}`)
    }
    console.error('\nNotes:')
    console.error('  - /run/secrets/r2/access-key-id is an R2 S3 key, not a Cloudflare API token.')
    console.error('  - Set CLOUDFLARE_API_TOKEN with Workers/D1/R2 permissions before bootstrap or deploy.')
    process.exit(1)
  }

  const whoami = await $`bunx wrangler whoami`
    .env({
      ...process.env,
      CLOUDFLARE_API_TOKEN: apiToken,
      CLOUDFLARE_ACCOUNT_ID: accountId,
    })
    .nothrow()
    .quiet()

  if (whoami.exitCode !== 0) {
    console.error('❌ Wrangler authentication check failed (wrangler whoami).')
    console.error('Ensure CLOUDFLARE_API_TOKEN is valid for this account and includes required scopes.')
    process.exit(1)
  }

  console.log('✅ Cloudflare preflight passed')
  console.log(`   Account ID: ${accountId}`)
  console.log('   Wrangler auth: OK')
  console.log('   S3 credentials: OK')
}

await main()
