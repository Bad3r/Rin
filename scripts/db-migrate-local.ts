import * as fs from 'node:fs'
import * as path from 'node:path'
import { $ } from 'bun'
import { fixTopField, getMigrationVersion, isInfoExist, updateMigrationVersion } from './db-fix-top-field'
import { isKnownTopColumnCatchUpCase } from './migration-utils'

const DB_NAME = 'rin'
const SQL_DIR = path.join(__dirname, '..', 'server', 'sql')

const ABOUT_SEED_SQL = `INSERT INTO feeds (alias, title, summary, content, listed, draft, uid, top, created_at, updated_at)
SELECT
  'about',
  'About',
  'Welcome to Rin. Update this page from the Writing panel.',
  'Welcome to Rin. Update this page from the Writing panel.',
  1,
  0,
  users.id,
  0,
  unixepoch(),
  unixepoch()
FROM users
WHERE users.permission = 1
  AND NOT EXISTS (SELECT 1 FROM feeds WHERE alias = 'about')
LIMIT 1;`

async function ensureAboutSeed(typ: string, dbName: string): Promise<void> {
  const { exitCode, stdout, stderr } = await $`bunx wrangler d1 execute ${dbName} --${typ} --command ${ABOUT_SEED_SQL}`
    .quiet()
    .nothrow()

  if (exitCode !== 0) {
    const output = `${stdout.toString()}\n${stderr.toString()}`.trim()
    console.error('Failed to seed default About page')
    if (output) {
      console.error(output)
    }
    process.exit(1)
  }
}

// Change to the server/sql directory
process.chdir(SQL_DIR)
const typ = 'local'
const migrationVersion = await getMigrationVersion(typ, DB_NAME)
const isInfoExistResult = await isInfoExist(typ, DB_NAME)
// List all SQL files and sort them
const sqlFiles = fs
  .readdirSync(SQL_DIR, { withFileTypes: true })
  .filter(dirent => dirent.isFile() && dirent.name.endsWith('.sql'))
  .map(dirent => dirent.name)
  .filter(file => {
    const version = parseInt(file.split('-')[0], 10)
    return version > migrationVersion
  })
  .sort()

console.log('Current migration_version:', migrationVersion)
console.log('Pending migration files:', sqlFiles)

// For each file in the sorted list
for (const file of sqlFiles) {
  const filePath = path.join(SQL_DIR, file)
  const { exitCode, stdout, stderr } = await $`bunx wrangler d1 execute ${DB_NAME} --local --file ${filePath}`
    .quiet()
    .nothrow()

  if (exitCode === 0) {
    console.log(`Executed migration ${file}`)
    continue
  }

  const output = `${stdout.toString()}\n${stderr.toString()}`.trim()
  if (isKnownTopColumnCatchUpCase(file, output)) {
    console.warn(`[migration] Skipping ${file}: feeds.top already exists`)
    continue
  }

  console.error(`Failed to execute migration ${file}`)
  if (output) {
    console.error(output)
  }
  process.exit(1)
}

if (sqlFiles.length === 0) {
  console.log('No pending migrations.')
} else {
  const lastVersion = parseInt(sqlFiles[sqlFiles.length - 1].split('-')[0], 10)
  if (lastVersion > migrationVersion) {
    // Update the migration version
    await updateMigrationVersion(typ, DB_NAME, lastVersion)
  }
}

await fixTopField(typ, DB_NAME, isInfoExistResult)
await ensureAboutSeed(typ, DB_NAME)

// Back to the root directory (optional, as the script ends)
process.chdir(__dirname)
