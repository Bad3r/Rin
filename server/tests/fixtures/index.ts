import { env as testEnv } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../src/db/schema'

type QueryRow = Record<string, unknown>

export function createMockDB() {
  const sqlite = testEnv.DB
  const db = drizzle(sqlite, { schema })
  return { db, sqlite }
}

type MockEnvOverrides = {
  [K in keyof Env]?: Env[K] extends string ? string : Env[K]
}

export function createMockEnv(overrides: MockEnvOverrides = {}): Env {
  return {
    DB: testEnv.DB,
    S3_FOLDER: 'images/',
    S3_CACHE_FOLDER: 'cache/',
    S3_REGION: 'auto',
    S3_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
    // Defaults intentionally use placeholder values so local tests don't rely on remote S3.
    S3_ACCESS_HOST: 'https://your-image-domain.com',
    S3_BUCKET: 'your-bucket-name',
    S3_FORCE_PATH_STYLE: 'false',
    WEBHOOK_URL: '',
    RSS_TITLE: 'Test Blog',
    RSS_DESCRIPTION: 'Test Environment',
    RIN_GITHUB_CLIENT_ID: 'test-client-id',
    RIN_GITHUB_CLIENT_SECRET: 'test-client-secret',
    JWT_SECRET: 'test-jwt-secret',
    ADMIN_USERNAME: '',
    ADMIN_PASSWORD: '',
    S3_ACCESS_KEY_ID: 'test-access-key',
    S3_SECRET_ACCESS_KEY: 'test-secret-key',
    CACHE_STORAGE_MODE: 'database',
    ROUTER_IMPL: 'hono',
    ...overrides,
  } as unknown as Env
}

export async function cleanupTestDB(_db: D1Database): Promise<void> {
  // Storage cleanup is handled by Workers Vitest isolated storage.
}

export async function execSql(db: D1Database, sql: string): Promise<void> {
  const statements = sql
    .split(';')
    .map(statement => statement.trim())
    .filter(statement => statement.length > 0)

  for (const statement of statements) {
    await db.prepare(statement).run()
  }
}

export async function queryAll<T extends QueryRow = QueryRow>(db: D1Database, sql: string): Promise<T[]> {
  const result = await db.prepare(sql).all<T>()
  if (!result.success) {
    throw new Error(`Failed SQL query: ${sql}`)
  }
  return (result.results ?? []) as T[]
}

export async function queryFirst<T extends QueryRow = QueryRow>(db: D1Database, sql: string): Promise<T | undefined> {
  const rows = await queryAll<T>(db, sql)
  return rows[0]
}

export async function createTestUser(db: D1Database): Promise<void> {
  await execSql(
    db,
    `
      INSERT INTO users (id, username, avatar, openid, permission)
      VALUES (1, 'testuser', 'avatar.png', 'gh_test', 1)
    `
  )
}

export async function seedTestData(db: D1Database): Promise<void> {
  await execSql(
    db,
    `
      INSERT INTO users (id, username, avatar, permission, openid) VALUES
        (1, 'testuser1', 'avatar1.png', 0, 'gh_1'),
        (2, 'testuser2', 'avatar2.png', 1, 'gh_2')
    `
  )

  await execSql(
    db,
    `
      INSERT INTO feeds (id, title, content, uid, draft, listed) VALUES
        (1, 'Test Feed 1', 'Content 1', 1, 0, 1),
        (2, 'Test Feed 2', 'Content 2', 1, 0, 1)
    `
  )

  await execSql(
    db,
    `
      INSERT INTO hashtags (id, name) VALUES
        (1, 'test'),
        (2, 'integration')
    `
  )

  await execSql(
    db,
    `
      INSERT INTO feed_hashtags (feed_id, hashtag_id) VALUES
        (1, 1),
        (1, 2),
        (2, 1)
    `
  )

  await execSql(
    db,
    `
      INSERT INTO comments (id, feed_id, user_id, content, created_at) VALUES
        (1, 1, 2, 'Test comment 1', unixepoch()),
        (2, 1, 1, 'Test comment 2', unixepoch())
    `
  )
}
