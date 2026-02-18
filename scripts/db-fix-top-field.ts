import { $ } from 'bun'

export async function fixTopField(typ: 'local' | 'remote', db: string, isInfoExistResult: boolean) {
  if (!isInfoExistResult) {
    console.log('Legacy database detected; checking feeds.top column')
    const result =
      await $`bunx wrangler d1 execute ${db}  --${typ} --json --command "SELECT name FROM pragma_table_info('feeds') WHERE name='top'"`
        .quiet()
        .json()
    if (result[0].results.length === 0) {
      console.log('Adding feeds.top column')
      await $`bunx wrangler d1 execute ${db}  --${typ} --json --command "ALTER TABLE feeds ADD COLUMN top INTEGER DEFAULT 0"`.quiet()
    } else {
      console.log('feeds.top column already exists')
    }
  } else {
    console.log('Fresh database detected; skipping feeds.top compatibility check')
  }
}

export async function isInfoExist(typ: 'local' | 'remote', db: string) {
  const result =
    await $`bunx wrangler d1 execute ${db}  --${typ} --json --command "SELECT name FROM sqlite_master WHERE type='table' AND name='info'"`
      .quiet()
      .json()
  if (result[0].results.length === 0) {
    console.log('info table does not exist')
    return false
  } else {
    console.log('info table already exists')
    return true
  }
}

export async function getMigrationVersion(typ: 'local' | 'remote', db: string) {
  const isInfoExistResult = await isInfoExist(typ, db)
  if (!isInfoExistResult) {
    console.log('Legacy database detected; migration_version is missing')
    return -1
  }
  const result =
    await $`bunx wrangler d1 execute ${db}  --${typ} --json --command "SELECT value FROM info WHERE key='migration_version'"`
      .quiet()
      .json()
  if (result[0].results.length === 0) {
    console.log('migration_version is missing')
    return -1
  } else {
    console.log('Current migration_version:', result[0].results[0].value)
    return parseInt(result[0].results[0].value, 10)
  }
}

export async function updateMigrationVersion(typ: 'local' | 'remote', db: string, version: number) {
  const exists = await isInfoExist(typ, db)
  if (!exists) {
    console.log('info table does not exist; cannot update migration_version')
    throw new Error('info table does not exist')
  }
  await $`bunx wrangler d1 execute ${db}  --${typ} --json --command "UPDATE info SET value='${version}' WHERE key='migration_version'"`.quiet()
  console.log('Updated migration_version to', version)
}
