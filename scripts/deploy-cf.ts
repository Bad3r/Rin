import { appendFile, readdir } from 'node:fs/promises'
import { $ } from 'bun'
import stripIndent from 'strip-indent'
import { fixTopField, getMigrationVersion, isInfoExist, updateMigrationVersion } from './db-fix-top-field'

function env(name: string, defaultValue?: string, required = false) {
  const env = process.env
  const value = env[name] || defaultValue
  if (required && !value) {
    throw new Error(`${name} is not defined`)
  }
  return value
}

// must be defined
const renv = (name: string, defaultValue?: string) => env(name, defaultValue, true)!

function tomlString(value: string): string {
  return JSON.stringify(value)
}

const DEPLOY_ENV = env('DEPLOY_ENV', 'production')
const isPreview = DEPLOY_ENV === 'preview'
if (DEPLOY_ENV !== 'production' && DEPLOY_ENV !== 'preview') {
  throw new Error(`DEPLOY_ENV must be production or preview, got: ${DEPLOY_ENV}`)
}

const DB_NAME = renv('DB_NAME', isPreview ? 'rin-preview' : 'rin')
const WORKER_NAME = renv('WORKER_NAME', isPreview ? 'rin-server-preview' : 'rin-server')
const D1_DATABASE_ID = env('D1_DATABASE_ID', '')
const GENERATED_WRANGLER_PATH = '.wrangler/deploy.generated.toml'

// R2 bucket name (optional, only used if S3 is not explicitly configured)
const R2_BUCKET_NAME = env('R2_BUCKET_NAME', '')

// S3 configuration (optional - will use R2 if not specified)
const S3_ENDPOINT = env('S3_ENDPOINT', '')
const S3_ACCESS_HOST = env('S3_ACCESS_HOST', S3_ENDPOINT)
const S3_BUCKET = env('S3_BUCKET', '')
const S3_CACHE_FOLDER = renv('S3_CACHE_FOLDER', 'cache/')
const S3_FOLDER = renv('S3_FOLDER', 'images/')
const S3_REGION = renv('S3_REGION', 'auto')
const S3_FORCE_PATH_STYLE = env('S3_FORCE_PATH_STYLE', 'false')
const WEBHOOK_URL = env('WEBHOOK_URL', '')
const RSS_TITLE = env('RSS_TITLE', '')
const RSS_DESCRIPTION = env('RSS_DESCRIPTION', '')
const CACHE_STORAGE_MODE = env('CACHE_STORAGE_MODE', 'database')

// Secrets
const accessKeyId = env('S3_ACCESS_KEY_ID')
const secretAccessKey = env('S3_SECRET_ACCESS_KEY')
const jwtSecret = env('JWT_SECRET')
const githubClientId = env('RIN_GITHUB_CLIENT_ID')
const githubClientSecret = env('RIN_GITHUB_CLIENT_SECRET')
const adminUsername = env('ADMIN_USERNAME')
const adminPassword = env('ADMIN_PASSWORD')
const requiredAuthSecrets: Array<[name: string, value: string | undefined]> = [
  ['JWT_SECRET', jwtSecret],
  ['ADMIN_USERNAME', adminUsername],
  ['ADMIN_PASSWORD', adminPassword],
]

// Frontend build configuration
const NAME = env('NAME', 'Rin')
const DESCRIPTION = env('DESCRIPTION', 'A lightweight personal blogging system')
const AVATAR = env('AVATAR', '')
const PAGE_SIZE = env('PAGE_SIZE', '5')
const RSS_ENABLE = env('RSS_ENABLE', 'false')

// Debug: Log environment variables
console.log('Environment variables:')
console.log(`  NAME: ${NAME}`)
console.log(`  DESCRIPTION: ${DESCRIPTION}`)
console.log(`  AVATAR: ${AVATAR}`)
console.log(`  PAGE_SIZE: ${PAGE_SIZE}`)
console.log(`  RSS_ENABLE: ${RSS_ENABLE}`)
console.log(`  DEPLOY_ENV: ${DEPLOY_ENV}`)
console.log(`  WORKER_NAME: ${WORKER_NAME}`)
console.log(`  DB_NAME: ${DB_NAME}`)

function validateRequiredSecrets(secrets: Array<[name: string, value: string | undefined]>) {
  const missing = secrets.filter(([, value]) => !value).map(([name]) => name)
  if (missing.length > 0) {
    console.error('Missing required deployment secrets:')
    for (const name of missing) {
      console.error(`  - ${name}`)
    }
    process.exit(1)
  }
}

async function getR2BucketInfo(): Promise<{ name: string; endpoint: string; accessHost: string } | null> {
  // Only use R2 if explicitly configured via R2_BUCKET_NAME
  if (!R2_BUCKET_NAME) {
    console.log('R2_BUCKET_NAME not set, skipping R2 configuration')
    return null
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) {
    console.log('CLOUDFLARE_ACCOUNT_ID not set, cannot configure R2')
    return null
  }

  console.log(`Using R2 bucket: ${R2_BUCKET_NAME}`)
  return {
    name: R2_BUCKET_NAME,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    accessHost: `https://${R2_BUCKET_NAME}.${accountId}.r2.dev`,
  }
}

// Build client
async function buildClient(): Promise<void> {
  console.log('🔨 Building client...')

  // Check if pre-built dist exists (vite.config.ts builds to ../dist/client)
  const artifactDist = './dist/client'
  const artifactIndexHtml = `${artifactDist}/index.html`
  const hasArtifact = await Bun.file(artifactIndexHtml).exists()

  if (hasArtifact) {
    console.log('✅ Using pre-built client from (./dist/client)')
    return
  }

  // Build the client (vite.config.ts outputs to ../dist/client)
  // Note: Client config is fetched from server at runtime, no env vars needed at build time
  await $`cd client && bun run build`.quiet()
  console.log('✅ Client built successfully')
}

async function deploy(): Promise<string> {
  console.log('🚀 Deploying Rin (Worker + Assets)...')
  validateRequiredSecrets(requiredAuthSecrets)

  // Determine final S3 configuration
  // Priority: 1. Explicit S3 config 2. R2 config (if S3 not set at all) 3. Empty values
  let finalS3Endpoint = S3_ENDPOINT
  let finalS3Bucket = S3_BUCKET
  let finalS3AccessHost = S3_ACCESS_HOST

  // Only use R2 if no S3 config is provided at all
  if (!S3_ENDPOINT && !S3_BUCKET && !S3_ACCESS_HOST) {
    const r2Info = await getR2BucketInfo()
    if (r2Info) {
      finalS3Endpoint = r2Info.endpoint
      finalS3Bucket = r2Info.name
      finalS3AccessHost = r2Info.accessHost
    }
  }

  // Build client
  await buildClient()

  // Determine server entry point - use built dist if available, otherwise use source
  const serverDistIndex = './dist/server/_worker.js'
  const hasServerBuild = await Bun.file(serverDistIndex).exists()
  // Wrangler resolves relative paths from the config file directory (.wrangler/)
  const serverMain = hasServerBuild ? '../dist/server/_worker.js' : '../server/src/_worker.ts'

  if (hasServerBuild) {
    console.log(`✅ Using pre-built server from ${serverMain}`)
  } else {
    console.log(`⚠️ No server build found, using source: ${serverMain}`)
  }

  // Create a deploy-specific wrangler config so repository source-of-truth remains untouched
  await $`mkdir -p .wrangler`
  await Bun.write(
    GENERATED_WRANGLER_PATH,
    stripIndent(`
#:schema node_modules/wrangler/config-schema.json
name = ${tomlString(WORKER_NAME)}
main = ${tomlString(serverMain)}
compatibility_date = "2026-01-20"

[assets]
directory = "../dist/client"
binding = "ASSETS"
run_worker_first = true
not_found_handling = "single-page-application"

[triggers]
crons = ["*/20 * * * *"]

[vars]
S3_FOLDER = ${tomlString(S3_FOLDER)}
S3_CACHE_FOLDER = ${tomlString(S3_CACHE_FOLDER)}
S3_REGION = ${tomlString(S3_REGION)}
S3_ENDPOINT = ${tomlString(finalS3Endpoint)}
S3_ACCESS_HOST = ${tomlString(finalS3AccessHost)}
S3_BUCKET = ${tomlString(finalS3Bucket)}
S3_FORCE_PATH_STYLE = ${tomlString(S3_FORCE_PATH_STYLE)}
WEBHOOK_URL = ${tomlString(WEBHOOK_URL)}
RSS_TITLE = ${tomlString(RSS_TITLE)}
RSS_DESCRIPTION = ${tomlString(RSS_DESCRIPTION)}
CACHE_STORAGE_MODE = ${tomlString(CACHE_STORAGE_MODE)}
NAME = ${tomlString(NAME)}
DESCRIPTION = ${tomlString(DESCRIPTION)}
AVATAR = ${tomlString(AVATAR)}
PAGE_SIZE = ${tomlString(PAGE_SIZE)}
RSS_ENABLE = ${tomlString(RSS_ENABLE)}

[placement]
mode = "smart"
`)
  )

  type D1Item = {
    uuid: string
    name: string
    version: string
    created_at: string
  }

  // Create D1 database
  const { exitCode, stderr, stdout } = await $`bunx wrangler d1 create ${DB_NAME}`.quiet().nothrow()
  if (exitCode !== 0) {
    if (!stderr.toString().includes('already exists')) {
      console.error(`Failed to create D1 "${DB_NAME}"`)
      console.error(stripIndent(stdout.toString()))
      console.log(`----------------------------`)
      console.error(stripIndent(stderr.toString()))
      process.exit(1)
    } else {
      console.log(`D1 "${DB_NAME}" already exists.`)
    }
  } else {
    console.log(`Created D1 "${DB_NAME}"`)
  }

  // Resolve D1 database id (prefer explicit D1_DATABASE_ID from CI env)
  let databaseId = D1_DATABASE_ID
  if (!databaseId) {
    console.log(`Searching D1 "${DB_NAME}"`)
    const listJsonString = await $`bunx wrangler d1 list --json`.quiet().text()
    const listJson = (JSON.parse(listJsonString) as D1Item[]) ?? []
    const existing = listJson.find((x: D1Item) => x.name === DB_NAME)
    if (!existing) {
      console.error(`Could not resolve D1 database id for "${DB_NAME}"`)
      process.exit(1)
    }
    databaseId = existing.uuid
  }

  await appendFile(
    GENERATED_WRANGLER_PATH,
    stripIndent(`
      
      [[d1_databases]]
      binding = "DB"
      database_name = ${tomlString(DB_NAME)}
      database_id = ${tomlString(databaseId)}
      
      [ai]
      binding = "AI"
    `)
  )
  console.log(`Using D1 database id: ${databaseId}`)
  console.log(`Generated config: ${GENERATED_WRANGLER_PATH}`)

  // Run migrations
  console.log(`----------------------------`)
  console.log(`Migrating D1 "${DB_NAME}"`)
  const typ = 'remote'
  const migrationVersion = await getMigrationVersion(typ, DB_NAME)
  const isInfoExistResult = await isInfoExist(typ, DB_NAME)

  try {
    const files = await readdir('./server/sql', { recursive: false })
    const sqlFiles = files
      .filter(name => name.endsWith('.sql'))
      .filter(name => {
        const version = parseInt(name.split('-')[0], 10)
        return version > migrationVersion
      })
      .sort()
    console.log('migration_version:', migrationVersion, 'Migration SQL List: ', sqlFiles)
    for (const file of sqlFiles) {
      await $`bunx wrangler d1 execute ${DB_NAME} --remote --file ./server/sql/${file} -y`
      console.log(`Migrated ${file}`)
    }
    if (sqlFiles.length === 0) {
      console.log('No migration needed.')
    } else {
      const lastVersion = parseInt(sqlFiles[sqlFiles.length - 1].split('-')[0], 10)
      if (lastVersion > migrationVersion) {
        await updateMigrationVersion(typ, DB_NAME, lastVersion)
      }
    }
  } catch (e: any) {
    console.error(e.stdio?.toString())
    console.error(e.stdout?.toString())
    console.error(e.stderr?.toString())
    process.exit(1)
  }

  console.log(`Migrated D1 "${DB_NAME}"`)
  console.log(`----------------------------`)
  console.log(`Patch D1`)
  await fixTopField(typ, DB_NAME, isInfoExistResult)
  console.log(`----------------------------`)
  console.log(`Migrate visits to HyperLogLog format`)
  await migrateVisitsToHLL(typ, DB_NAME)
  console.log(`----------------------------`)
  console.log(`Put secrets`)

  async function putSecret(name: string, value?: string) {
    if (value) {
      console.log(`Put ${name}`)
      const proc = Bun.spawn(['bunx', 'wrangler', 'secret', 'put', name, '--config', GENERATED_WRANGLER_PATH], {
        stdin: 'pipe',
        stdout: 'inherit',
        stderr: 'inherit',
      })

      const writer = proc.stdin.getWriter()
      await writer.write(new TextEncoder().encode(`${value}\n`))
      await writer.close()

      const exitCode = await proc.exited
      if (exitCode !== 0) {
        console.error(`Failed to put ${name}.`)
        process.exit(exitCode)
      }
    } else {
      console.log(`Skip ${name}, value is not defined.`)
    }
  }

  await putSecret('S3_ACCESS_KEY_ID', accessKeyId)
  await putSecret('S3_SECRET_ACCESS_KEY', secretAccessKey)
  await putSecret('RIN_GITHUB_CLIENT_ID', githubClientId)
  await putSecret('RIN_GITHUB_CLIENT_SECRET', githubClientSecret)
  await putSecret('JWT_SECRET', jwtSecret)
  await putSecret('ADMIN_USERNAME', adminUsername)
  await putSecret('ADMIN_PASSWORD', adminPassword)

  console.log(`Put Done.`)
  console.log(`----------------------------`)
  console.log(`Deploying Worker with Assets`)
  console.log(`Environment: ${DEPLOY_ENV}`)

  // Deploy worker with assets
  const deployProc = Bun.spawn(['bunx', 'wrangler', 'deploy', '--config', GENERATED_WRANGLER_PATH], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const deployWriter = deployProc.stdin.getWriter()
  await deployWriter.write(new TextEncoder().encode('n\ny\n'))
  await deployWriter.close()

  const deployOutputPromise = deployProc.stdout ? new Response(deployProc.stdout).text() : Promise.resolve('')
  const deployStderrPromise = deployProc.stderr ? new Response(deployProc.stderr).text() : Promise.resolve('')
  const [deployOutput, deployStderr, deployExitCode] = await Promise.all([
    deployOutputPromise,
    deployStderrPromise,
    deployProc.exited,
  ])
  if (deployExitCode !== 0) {
    console.error('wrangler deploy failed:')
    console.error(deployStderr || deployOutput)
    process.exit(deployExitCode)
  }

  // Extract worker URL from deploy output
  const fullOutput = deployOutput + deployStderr
  const urlMatch = fullOutput.match(/https:\/\/[^\s]+\.workers\.dev/)
  const workerUrl = urlMatch ? urlMatch[0] : null

  if (workerUrl) {
    console.log(`🌐 Worker URL: ${workerUrl}`)
    console.log(`✅ Deployment completed successfully!`)
    console.log(``)
    console.log(`Your app is now available at: ${workerUrl}`)
  } else {
    console.log(`⚠️ Could not extract Worker URL from output`)
    console.log(`Debug - Output preview: ${fullOutput.substring(0, 500)}`)
  }

  return workerUrl || `https://${WORKER_NAME}.workers.dev`
}

// Parse wrangler JSON output to extract count value (with --json flag)
function parseWranglerCount(stdout: string): number {
  try {
    const json = JSON.parse(stdout)
    if (Array.isArray(json) && json.length > 0 && json[0].results && json[0].results.length > 0) {
      return parseInt(json[0].results[0].count, 10) || 0
    }
  } catch (_e) {
    const match = stdout.match(/"count":\s*(\d+)/)
    if (match) {
      return parseInt(match[1], 10) || 0
    }
  }
  return 0
}

// Parse wrangler JSON output to extract feed_id values (with --json flag)
function parseWranglerFeedIds(stdout: string): number[] {
  try {
    const json = JSON.parse(stdout)
    if (Array.isArray(json) && json.length > 0 && json[0].results) {
      return json[0].results.map((row: any) => parseInt(row.feed_id, 10)).filter((id: number) => !Number.isNaN(id))
    }
  } catch (_e) {
    return stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^\d+$/.test(line))
      .map(id => parseInt(id, 10))
  }
  return []
}

// Parse wrangler JSON output to extract IP addresses (with --json flag)
function parseWranglerIPs(stdout: string): string[] {
  try {
    const json = JSON.parse(stdout)
    if (json.results) {
      return json.results.map((row: any) => row.ip).filter((ip: string) => ip && typeof ip === 'string')
    }
  } catch (_e) {
    return stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !/^\d+$/.test(line) && line !== 'ip')
  }
  return []
}

// Migrate existing visits data to HyperLogLog format
async function migrateVisitsToHLL(typ: string, dbName: string) {
  console.log(`Checking if HyperLogLog migration is needed...`)

  try {
    const { stdout: countResult } =
      await $`bunx wrangler d1 execute ${dbName} --${typ} --json --command="SELECT COUNT(*) as count FROM visit_stats WHERE hll_data != ''"`.quiet()
    const migratedCount = parseWranglerCount(countResult.toString())

    if (migratedCount > 0) {
      console.log(`  ${migratedCount} feeds already have HLL data. Migration may already be complete.`)
      return
    }

    const { stdout: visitsCount } =
      await $`bunx wrangler d1 execute ${dbName} --${typ} --json --command="SELECT COUNT(*) as count FROM visits"`.quiet()
    const totalVisits = parseWranglerCount(visitsCount.toString())

    if (totalVisits === 0) {
      console.log('  No visits to migrate. Skipping.')
      return
    }

    console.log(`  Found ${totalVisits} visits to migrate to HyperLogLog format.`)
    console.log('  Starting migration...')

    const { stdout: feedIdsResult } =
      await $`bunx wrangler d1 execute ${dbName} --${typ} --json --command="SELECT DISTINCT feed_id FROM visits"`.quiet()
    const feedIds = parseWranglerFeedIds(feedIdsResult.toString())

    console.log(`  Processing ${feedIds.length} feeds...`)

    let processed = 0
    for (const feedId of feedIds) {
      try {
        // feedIds are parsed to integers and NaN-filtered in parseWranglerFeedIds.
        const { stdout: ipsResult } =
          await $`bunx wrangler d1 execute ${dbName} --${typ} --json --command="SELECT ip FROM visits WHERE feed_id = ${feedId}"`.quiet()
        const ips = parseWranglerIPs(ipsResult.toString())

        if (ips.length === 0) {
          console.log(`    Feed ${feedId}: No IPs found, skipping`)
          continue
        }

        console.log(`    Feed ${feedId}: Found ${ips.length} visits`)

        const hllData = await generateHLLData(ips)
        const uv = Math.round(await estimateUV(hllData))
        const pv = ips.length
        const timestamp = Math.floor(Date.now() / 1000)

        console.log(`    Feed ${feedId}: PV=${pv}, UV=${uv}`)

        const escapedHllData = hllData.replace(/'/g, "''")
        const sqlCommand = `INSERT OR REPLACE INTO visit_stats (feed_id, pv, hll_data, updated_at) VALUES (${feedId}, ${pv}, '${escapedHllData}', ${timestamp})`

        const result = await $`bunx wrangler d1 execute ${dbName} --${typ} --command=${sqlCommand}`.nothrow().quiet()

        if (result.exitCode !== 0) {
          console.error(`    ❌ Failed to insert feed ${feedId}: ${result.stderr}`)
          continue
        }

        console.log(`    ✅ Feed ${feedId}: Inserted successfully`)
        processed++

        if (processed % 10 === 0) {
          console.log(`    Progress: ${processed}/${feedIds.length} feeds processed`)
        }
      } catch (error) {
        console.error(`    ❌ Error processing feed ${feedId}:`, error)
      }
    }

    console.log(`\n✅ Migration completed! Processed ${processed} feeds.`)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

// Generate HLL data from IPs
async function generateHLLData(ips: string[]): Promise<string> {
  const { HyperLogLog } = await import('../server/src/utils/hyperloglog')
  const hll = new HyperLogLog()
  for (const ip of ips) {
    hll.add(ip)
  }
  return hll.serialize()
}

// Estimate UV from HLL data
async function estimateUV(hllData: string): Promise<number> {
  const { HyperLogLog } = await import('../server/src/utils/hyperloglog')
  const hll = new HyperLogLog(hllData)
  return hll.count()
}

// Main entry point
async function main() {
  const args = process.argv.slice(2)
  const deployTarget = args[0] || 'all'

  console.log('🚀 Starting Rin deployment...')
  console.log(`Target: ${deployTarget}`)
  console.log(``)

  try {
    const url = await deploy()
    console.log(`\n🎉 Deployment completed successfully!`)
    console.log(`🌐 App URL: ${url}`)
  } catch (error) {
    console.error('\n❌ Deployment failed:', error)
    process.exit(1)
  }
}

main()
