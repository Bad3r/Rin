import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTestDB, createMockDB, createMockEnv, execSql, queryFirst } from '../../../tests/fixtures'
import { createTestClient } from '../../../tests/test-api-client'
import { createBaseApp } from '../../core/base'
import { FriendService } from '../friends'

describe('FriendService', () => {
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
    app.state('clientConfig', {
      get: async () => undefined,
      set: async () => {},
      save: async () => {},
      all: async () => [],
      getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
    })
    app.state('serverConfig', {
      get: async () => undefined,
      set: async () => {},
      save: async () => {},
      all: async () => [],
      getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
    })

    FriendService(app)
    api = createTestClient(app, env)

    await execSql(
      sqlite,
      `
        INSERT INTO users (id, username, openid, avatar, permission)
        VALUES
          (1, 'admin', 'gh_admin', 'admin.png', 1),
          (2, 'regular', 'gh_regular', 'regular.png', 0),
          (3, 'other', 'gh_other', 'other.png', 0)
      `
    )
  })

  afterEach(async () => {
    await cleanupTestDB(sqlite)
  })

  describe('GET /friend - List friends', () => {
    it('should return only accepted friends for non-admin', async () => {
      await execSql(
        sqlite,
        `
          INSERT INTO friends (id, name, desc, avatar, url, uid, accepted, sort_order)
          VALUES
            (1, 'Friend 1', 'Desc 1', 'avatar1.png', 'https://friend1.com', 2, 1, 0),
            (2, 'Friend 2', 'Desc 2', 'avatar2.png', 'https://friend2.com', 2, 0, 0)
        `
      )

      const result = await api.friend.list()

      expect(result.error).toBeUndefined()
      expect(Array.isArray(result.data?.friend_list)).toBe(true)
      expect(result.data?.friend_list.length).toBe(1)
      expect(result.data?.friend_list[0].name).toBe('Friend 1')
    })

    it('should return all friends for admin', async () => {
      await execSql(
        sqlite,
        `
          INSERT INTO friends (id, name, desc, avatar, url, uid, accepted, sort_order)
          VALUES
            (1, 'Friend 1', 'Desc 1', 'avatar1.png', 'https://friend1.com', 2, 1, 0),
            (2, 'Friend 2', 'Desc 2', 'avatar2.png', 'https://friend2.com', 2, 0, 0)
        `
      )

      const result = await api.friend.list({ token: 'mock_token_1' })

      expect(result.error).toBeUndefined()
      expect(result.data?.friend_list.length).toBe(2)
    })

    it('should return empty list when no friends exist', async () => {
      const result = await api.friend.list()

      expect(result.error).toBeUndefined()
      expect(result.data?.friend_list).toEqual([])
    })

    it('should include apply_list for authenticated user', async () => {
      await execSql(
        sqlite,
        `
          INSERT INTO friends (id, name, desc, avatar, url, uid, accepted, sort_order)
          VALUES (1, 'My Friend', 'Desc', 'avatar.png', 'https://example.com', 2, 0, 0)
        `
      )

      const result = await api.friend.list({ token: 'mock_token_2' })

      expect(result.error).toBeUndefined()
      expect(result.data?.apply_list).toBeDefined()
    })
  })

  describe('POST /friend - Create friend', () => {
    it('should require authentication', async () => {
      const result = await api.friend.create({
        name: 'New Friend',
        desc: 'Description',
        avatar: 'avatar.png',
        url: 'https://example.com',
      })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(401)
    })

    it('should allow admin to create friend directly', async () => {
      const result = await api.friend.create(
        {
          name: 'New Friend',
          desc: 'Description',
          avatar: 'avatar.png',
          url: 'https://example.com',
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeUndefined()

      const row = await queryFirst<{ accepted: number }>(
        sqlite,
        "SELECT accepted FROM friends WHERE name = 'New Friend' LIMIT 1"
      )
      expect(row?.accepted).toBe(1)
    })

    it('should reject when friend apply is disabled', async () => {
      app.state('clientConfig', {
        get: async (key: string) => (key === 'friend_apply_enable' ? false : undefined),
        set: async () => {},
        save: async () => {},
        all: async () => [],
        getOrDefault: async (key: string, defaultValue: unknown) =>
          key === 'friend_apply_enable' ? false : defaultValue,
      })

      const result = await api.friend.create(
        {
          name: 'New Friend',
          desc: 'Description',
          avatar: 'avatar.png',
          url: 'https://example.com',
        },
        { token: 'mock_token_2' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(403)
    })

    it('should validate input length', async () => {
      const result = await api.friend.create(
        {
          name: 'a'.repeat(21),
          desc: 'Description',
          avatar: 'avatar.png',
          url: 'https://example.com',
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(400)
    })

    it('should require all fields', async () => {
      const result = await api.friend.create(
        {
          name: '',
          desc: '',
          avatar: '',
          url: '',
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(400)
    })

    it('should prevent duplicate friend request from same user', async () => {
      await execSql(
        sqlite,
        `
          INSERT INTO friends (id, name, desc, avatar, url, uid, accepted)
          VALUES (1, 'Existing Friend', 'Desc', 'avatar.png', 'https://example.com', 2, 0)
        `
      )

      const result = await api.friend.create(
        {
          name: 'Another Friend',
          desc: 'Description',
          avatar: 'avatar.png',
          url: 'https://example2.com',
        },
        { token: 'mock_token_2' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(400)
    })
  })

  describe('PUT /friend/:id - Update friend', () => {
    beforeEach(async () => {
      await execSql(
        sqlite,
        `
          INSERT INTO friends (id, name, desc, avatar, url, uid, accepted, sort_order)
          VALUES (1, 'Original Name', 'Original Desc', 'avatar.png', 'https://example.com', 2, 0, 0)
        `
      )
    })

    it('should require authentication', async () => {
      const result = await api.friend.update(1, {
        name: 'Updated Name',
        desc: 'Updated Desc',
        url: 'https://example.com',
      })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(401)
    })

    it('should allow admin to update any friend', async () => {
      const result = await api.friend.update(
        1,
        {
          name: 'Updated Name',
          desc: 'Updated Desc',
          url: 'https://new-example.com',
          accepted: 1,
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeUndefined()

      const row = await queryFirst<{ accepted: number; url: string }>(
        sqlite,
        'SELECT accepted, url FROM friends WHERE id = 1 LIMIT 1'
      )
      expect(row?.accepted).toBe(1)
      expect(row?.url).toBe('https://new-example.com')
    })

    it('should allow user to update their own friend', async () => {
      const result = await api.friend.update(
        1,
        {
          name: 'Updated Name',
          desc: 'Updated Desc',
          url: 'https://example.com',
        },
        { token: 'mock_token_2' }
      )

      expect(result.error).toBeUndefined()
    })

    it('should not allow user to update others friend', async () => {
      const result = await api.friend.update(
        1,
        {
          name: 'Updated Name',
          desc: 'Updated Desc',
          url: 'https://example.com',
        },
        { token: 'mock_token_3' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(403)
    })

    it('should return 404 for non-existent friend', async () => {
      const result = await api.friend.update(
        999,
        {
          name: 'Updated Name',
          desc: 'Updated Desc',
          url: 'https://example.com',
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(404)
    })

    it('should reset accepted status for non-admin updates', async () => {
      await execSql(sqlite, 'UPDATE friends SET accepted = 1 WHERE id = 1')

      const updateResult = await api.friend.update(
        1,
        {
          name: 'Updated Name',
          desc: 'Updated Desc',
          url: 'https://example.com',
        },
        { token: 'mock_token_2' }
      )

      expect(updateResult.error).toBeUndefined()

      const row = await queryFirst<{ accepted: number }>(sqlite, 'SELECT accepted FROM friends WHERE id = 1 LIMIT 1')
      expect(row?.accepted).toBe(0)
    })
  })

  describe('DELETE /friend/:id - Delete friend', () => {
    beforeEach(async () => {
      await execSql(
        sqlite,
        `
          INSERT INTO friends (id, name, desc, avatar, url, uid, accepted)
          VALUES (1, 'Friend Name', 'Desc', 'avatar.png', 'https://example.com', 2, 1)
        `
      )
    })

    it('should require authentication', async () => {
      const result = await api.friend.delete(1)

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(401)
    })

    it('should allow admin to delete any friend', async () => {
      const result = await api.friend.delete(1, { token: 'mock_token_1' })

      expect(result.error).toBeUndefined()

      const row = await queryFirst<{ id: number }>(sqlite, 'SELECT id FROM friends WHERE id = 1 LIMIT 1')
      expect(row).toBeUndefined()
    })

    it('should allow user to delete their own friend', async () => {
      const result = await api.friend.delete(1, { token: 'mock_token_2' })

      expect(result.error).toBeUndefined()
    })

    it('should not allow user to delete others friend', async () => {
      const result = await api.friend.delete(1, { token: 'mock_token_3' })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(403)
    })

    it('should return 404 for non-existent friend', async () => {
      const result = await api.friend.delete(999, { token: 'mock_token_1' })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(404)
    })
  })
})
