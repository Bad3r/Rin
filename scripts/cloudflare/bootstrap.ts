#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { $ } from 'bun'

type TargetEnv = 'production' | 'preview'

type EnvConfig = {
  key: TargetEnv
  workerName: string
  dbName: string
  bucketName: string
}

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

function resolveConfig(target: TargetEnv): EnvConfig {
  const defaultWorker = target === 'production' ? 'rin-server' : 'rin-server-preview'
  const defaultDb = target === 'production' ? 'rin' : 'rin-preview'
  const defaultBucket = target === 'production' ? 'rin-images' : 'rin-images-preview'

  if (target === 'production') {
    return {
      key: target,
      workerName: firstValue(process.env.WORKER_NAME, process.env.CF_WORKER_NAME_PRODUCTION, defaultWorker),
      dbName: firstValue(process.env.DB_NAME, process.env.CF_D1_DB_PRODUCTION, defaultDb),
      bucketName: firstValue(process.env.R2_BUCKET_NAME, process.env.CF_R2_BUCKET_PRODUCTION, defaultBucket),
    }
  }

  return {
    key: target,
    workerName: firstValue(process.env.PREVIEW_WORKER_NAME, process.env.CF_WORKER_NAME_PREVIEW, defaultWorker),
    dbName: firstValue(process.env.PREVIEW_DB_NAME, process.env.CF_D1_DB_PREVIEW, defaultDb),
    bucketName: firstValue(process.env.PREVIEW_R2_BUCKET_NAME, process.env.CF_R2_BUCKET_PREVIEW, defaultBucket),
  }
}

async function ensureD1Database(config: EnvConfig, wranglerEnv: Record<string, string>) {
  const createResult = await $`bunx wrangler d1 create ${config.dbName}`.env(wranglerEnv).nothrow().quiet()

  if (createResult.exitCode === 0) {
    console.log(`✅ Created D1 database ${config.dbName} (${config.key})`)
    return
  }

  const stderr = createResult.stderr.toString()
  if (stderr.includes('already exists')) {
    console.log(`ℹ️  D1 database already exists: ${config.dbName} (${config.key})`)
    return
  }

  console.error(`❌ Failed to create D1 database ${config.dbName} (${config.key})`)
  console.error(stderr)
  process.exit(1)
}

async function ensureR2Bucket(config: EnvConfig, wranglerEnv: Record<string, string>) {
  const createResult = await $`bunx wrangler r2 bucket create ${config.bucketName}`.env(wranglerEnv).nothrow().quiet()

  if (createResult.exitCode === 0) {
    console.log(`✅ Created R2 bucket ${config.bucketName} (${config.key})`)
    return
  }

  const stderr = createResult.stderr.toString()
  if (stderr.includes('already exists')) {
    console.log(`ℹ️  R2 bucket already exists: ${config.bucketName} (${config.key})`)
    return
  }

  console.error(`❌ Failed to create R2 bucket ${config.bucketName} (${config.key})`)
  console.error(stderr)
  process.exit(1)
}

async function d1DatabaseId(dbName: string, wranglerEnv: Record<string, string>): Promise<string> {
  const result = await $`bunx wrangler d1 list --json`.env(wranglerEnv).quiet().text()
  const list = JSON.parse(result) as Array<{ name: string; uuid: string }>
  const db = list.find(item => item.name === dbName)
  if (!db) {
    console.error(`❌ Could not find D1 database id for ${dbName}`)
    process.exit(1)
  }
  return db.uuid
}

async function main() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      env: { type: 'string', default: 'all' },
    },
    strict: true,
  })

  const rawEnvArg = String(values.env ?? 'all')
  const envArg = rawEnvArg.toLowerCase()
  let targets: TargetEnv[]

  switch (envArg) {
    case 'all':
      targets = ['production', 'preview']
      break
    case 'production':
    case 'prod':
      targets = ['production']
      break
    case 'preview':
    case 'prev':
      targets = ['preview']
      break
    default:
      console.error(`❌ Invalid --env value: ${rawEnvArg}`)
      console.error('Allowed values: all, production (prod), preview (prev)')
      process.exit(1)
  }

  const accountId = firstValue(process.env.CLOUDFLARE_ACCOUNT_ID, readSecret('/run/secrets/r2/account-id'))
  const apiToken = firstValue(process.env.CLOUDFLARE_API_TOKEN)

  if (!accountId || !apiToken) {
    console.error('❌ Missing CLOUDFLARE credentials for bootstrap.')
    console.error('Required: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (or /run/secrets/r2/account-id).')
    process.exit(1)
  }

  const wranglerEnv = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: apiToken,
    CLOUDFLARE_ACCOUNT_ID: accountId,
  } as Record<string, string>

  console.log('🚀 Bootstrapping Cloudflare resources')
  console.log(`   Account ID: ${accountId}`)
  console.log(`   Target envs: ${targets.join(', ')}`)

  for (const target of targets) {
    const config = resolveConfig(target)
    console.log(`\n== ${target.toUpperCase()} ==`)
    console.log(`Worker: ${config.workerName}`)
    console.log(`D1: ${config.dbName}`)
    console.log(`R2: ${config.bucketName}`)

    await ensureD1Database(config, wranglerEnv)
    await ensureR2Bucket(config, wranglerEnv)

    const databaseId = await d1DatabaseId(config.dbName, wranglerEnv)

    console.log('Suggested GitHub environment variables:')
    console.log(`  WORKER_NAME=${config.workerName}`)
    console.log(`  DB_NAME=${config.dbName}`)
    console.log(`  D1_DATABASE_ID=${databaseId}`)
    console.log(`  R2_BUCKET_NAME=${config.bucketName}`)
  }

  console.log('\n✅ Cloudflare bootstrap completed')
}

await main()
