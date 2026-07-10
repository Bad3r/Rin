import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTestDB, createMockDB, createMockEnv, execSql, queryFirst } from '../../../tests/fixtures'
import { createTestClient } from '../../../tests/test-api-client'
import { createBaseApp } from '../../core/base'
import { MomentsService } from '../moments'

describe('MomentsService', () => {
  let sqlite: D1Database
  let env: Env
  let app: ReturnType<typeof createBaseApp>
  let api: ReturnType<typeof createTestClient>

  beforeEach(async () => {
    const mockDB = createMockDB()
    sqlite = mockDB.sqlite
    env = createMockEnv()

    app = createBaseApp(env)
    app.state('db', mockDB.db)
    app.state('jwt', {
      sign: async (payload: Record<string, unknown>) => `mock_token_${String(payload.id ?? '')}`,
      verify: async (token: string) => {
        const match = token.match(/mock_token_(\d+)/)
        return match ? { id: Number.parseInt(match[1], 10) } : null
      },
    })
    app.state('cache', {
      get: async () => undefined,
      set: async () => {},
      delete: async () => {},
      deletePrefix: async () => {},
      getOrSet: async (_key: string, fn: () => unknown) => fn(),
      getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
    })

    MomentsService(app)
    api = createTestClient(app, env)

    await execSql(
      sqlite,
      `
        INSERT INTO users (id, username, openid, avatar, permission)
        VALUES
          (1, 'admin', 'gh_admin', 'admin.png', 1),
          (2, 'regular', 'gh_regular', 'regular.png', 0)
      `
    )
  })

  afterEach(async () => {
    await cleanupTestDB(sqlite)
  })

  describe('GET /moments - List moments', () => {
    it('should return empty list when no moments exist', async () => {
      const result = await api.moments.list()

      expect(result.error).toBeUndefined()
      expect(result.data?.data).toEqual([])
      expect(result.data?.hasNext).toBe(false)
    })

    it('should return paginated moments', async () => {
      await execSql(
        sqlite,
        `
          INSERT INTO moments (id, content, uid, created_at, updated_at)
          VALUES
            (1, 'Moment 1', 1, 1000, 1000),
            (2, 'Moment 2', 1, 2000, 2000),
            (3, 'Moment 3', 1, 3000, 3000)
        `
      )

      const result = await api.moments.list({ page: 1, limit: 2 })

      expect(result.error).toBeUndefined()
      expect(result.data?.data.length).toBe(2)
      expect(result.data?.hasNext).toBe(true)
    })

    it('should return cached result if available', async () => {
      const cachedData = {
        size: 1,
        data: [{ id: 1, content: 'Cached Moment', uid: 1, createdAt: Date.now() }],
        hasNext: false,
      }

      app.state('cache', {
        get: async () => cachedData,
        set: async () => {},
        delete: async () => {},
        deletePrefix: async () => {},
        getOrSet: async (_key: string, fn: () => unknown) => fn(),
        getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
      })

      const result = await api.moments.list()

      expect(result.error).toBeUndefined()
      expect(result.data?.data[0].content).toBe('Cached Moment')
    })

    it('should limit to maximum 50 items per page', async () => {
      const values = Array.from(
        { length: 55 },
        (_, i) => `(${i + 1}, 'Moment ${i + 1}', 1, ${1000 + i}, ${1000 + i})`
      ).join(',')

      await execSql(sqlite, `INSERT INTO moments (id, content, uid, created_at, updated_at) VALUES ${values}`)

      const result = await api.moments.list({ page: 1, limit: 100 })

      expect(result.error).toBeUndefined()
      expect(result.data?.data.length).toBeLessThanOrEqual(50)
    })

    it('should order moments by createdAt descending', async () => {
      await execSql(
        sqlite,
        `
          INSERT INTO moments (id, content, uid, created_at, updated_at)
          VALUES
            (1, 'Oldest', 1, 1000, 1000),
            (2, 'Middle', 1, 2000, 2000),
            (3, 'Newest', 1, 3000, 3000)
        `
      )

      const result = await api.moments.list()

      expect(result.error).toBeUndefined()
      expect(result.data?.data[0].content).toBe('Newest')
      expect(result.data?.data[2].content).toBe('Oldest')
    })
  })

  describe('POST /moments - Create moment', () => {
    it('should require authentication', async () => {
      const result = await api.moments.create({ content: 'Test moment' })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(401)
    })

    it('should require admin permission', async () => {
      const result = await api.moments.create(
        {
          content: 'Test moment',
        },
        { token: 'mock_token_2' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(403)
    })

    it('should allow admin to create moment', async () => {
      const result = await api.moments.create(
        {
          content: 'Test moment content',
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeUndefined()

      const row = await queryFirst<{ content: string }>(sqlite, 'SELECT content FROM moments WHERE id = 1 LIMIT 1')
      expect(row).toBeDefined()
      expect(row?.content).toBe('Test moment content')
    })

    it('should require content', async () => {
      const result = await api.moments.create(
        {
          content: '',
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(400)
    })

    it('should clear cache after creating', async () => {
      let cacheCleared = false
      app.state('cache', {
        get: async () => undefined,
        set: async () => {},
        delete: async () => {},
        deletePrefix: async (prefix: string) => {
          if (prefix === 'moments_') {
            cacheCleared = true
          }
        },
        getOrSet: async (_key: string, fn: () => unknown) => fn(),
        getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
      })

      await api.moments.create(
        {
          content: 'Test moment',
        },
        { token: 'mock_token_1' }
      )

      expect(cacheCleared).toBe(true)
    })
  })

  describe('POST /moments/:id - Update moment', () => {
    beforeEach(async () => {
      await execSql(
        sqlite,
        `
          INSERT INTO moments (id, content, uid, created_at, updated_at)
          VALUES (1, 'Original content', 1, 1000, 1000)
        `
      )
    })

    it('should require authentication', async () => {
      const result = await api.moments.update(1, {
        content: 'Updated content',
      })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(401)
    })

    it('should require admin permission', async () => {
      const result = await api.moments.update(
        1,
        {
          content: 'Updated content',
        },
        { token: 'mock_token_2' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(403)
    })

    it('should allow admin to update moment', async () => {
      const result = await api.moments.update(
        1,
        {
          content: 'Updated content',
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeUndefined()

      const row = await queryFirst<{ content: string }>(sqlite, 'SELECT content FROM moments WHERE id = 1 LIMIT 1')
      expect(row?.content).toBe('Updated content')
    })

    it('should return 404 for non-existent moment', async () => {
      const result = await api.moments.update(
        999,
        {
          content: 'Updated content',
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(404)
    })

    it('should require content', async () => {
      const result = await api.moments.update(
        1,
        {
          content: '',
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(400)
    })

    it('should clear cache after updating', async () => {
      let cacheCleared = false
      app.state('cache', {
        get: async () => undefined,
        set: async () => {},
        delete: async () => {},
        deletePrefix: async (prefix: string) => {
          if (prefix === 'moments_') {
            cacheCleared = true
          }
        },
        getOrSet: async (_key: string, fn: () => unknown) => fn(),
        getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
      })

      await api.moments.update(
        1,
        {
          content: 'Updated content',
        },
        { token: 'mock_token_1' }
      )

      expect(cacheCleared).toBe(true)
    })
  })

  describe('DELETE /moments/:id - Delete moment', () => {
    beforeEach(async () => {
      await execSql(
        sqlite,
        `
          INSERT INTO moments (id, content, uid, created_at, updated_at)
          VALUES (1, 'Moment to delete', 1, 1000, 1000)
        `
      )
    })

    it('should require authentication', async () => {
      const result = await api.moments.delete(1)

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(401)
    })

    it('should require admin permission', async () => {
      const result = await api.moments.delete(1, { token: 'mock_token_2' })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(403)
    })

    it('should allow admin to delete moment', async () => {
      const result = await api.moments.delete(1, { token: 'mock_token_1' })

      expect(result.error).toBeUndefined()

      const row = await queryFirst<{ id: number }>(sqlite, 'SELECT id FROM moments WHERE id = 1 LIMIT 1')
      expect(row).toBeUndefined()
    })

    it('should return 404 for non-existent moment', async () => {
      const result = await api.moments.delete(999, { token: 'mock_token_1' })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(404)
    })

    it('should clear cache after deleting', async () => {
      let cacheCleared = false
      app.state('cache', {
        get: async () => undefined,
        set: async () => {},
        delete: async () => {},
        deletePrefix: async (prefix: string) => {
          if (prefix === 'moments_') {
            cacheCleared = true
          }
        },
        getOrSet: async (_key: string, fn: () => unknown) => fn(),
        getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
      })

      await api.moments.delete(1, { token: 'mock_token_1' })

      expect(cacheCleared).toBe(true)
    })
  })
})
