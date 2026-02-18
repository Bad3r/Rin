import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTestDB, createMockDB, execSql, queryFirst } from '../fixtures'

describe('test fixtures SQL helpers', () => {
  let sqlite: D1Database

  beforeEach(() => {
    sqlite = createMockDB().sqlite
  })

  afterEach(async () => {
    await cleanupTestDB(sqlite)
  })

  it('execSql handles semicolons inside SQL string literals', async () => {
    await execSql(
      sqlite,
      `
      CREATE TABLE IF NOT EXISTS fixture_semicolon_test (
        id INTEGER PRIMARY KEY,
        value TEXT NOT NULL
      );
      DELETE FROM fixture_semicolon_test;
      INSERT INTO fixture_semicolon_test (id, value) VALUES (1, 'alpha;beta;gamma');
      `
    )

    const row = await queryFirst<{ value: string }>(sqlite, `SELECT value FROM fixture_semicolon_test WHERE id = 1`)
    expect(row?.value).toBe('alpha;beta;gamma')
  })
})
