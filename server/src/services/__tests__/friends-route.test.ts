import type { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { cleanupTestDB, createMockDB, createMockEnv } from '../../../tests/fixtures'
import { createTestClient } from '../../../tests/test-api-client'
import { createBaseApp } from '../../core/base'
import { FriendService } from '../friends'

type RouterImpl = 'legacy' | 'hono'
const ROUTER_IMPLS: RouterImpl[] = ['legacy', 'hono']

for (const impl of ROUTER_IMPLS) {
  describe(`FriendService route mount (${impl})`, () => {
    let app: ReturnType<typeof createBaseApp>
    let env: Env
    let sqlite: Database

    beforeEach(() => {
      const mockDB = createMockDB()
      sqlite = mockDB.sqlite

      env = createMockEnv({ ROUTER_IMPL: impl })
      app = createBaseApp(env)
      app.state('db', mockDB.db)
      app.state('cache', {
        get: async () => undefined,
        set: async () => {},
        deletePrefix: async () => {},
        getOrSet: async (_key: string, fn: () => unknown) => fn(),
        getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
      })
      app.state('serverConfig', {
        get: async () => undefined,
        getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
      })
      app.state('clientConfig', {
        get: async () => undefined,
        getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
      })
      app.state('jwt', {
        sign: async (payload: Record<string, unknown>) => `mock_token_${String(payload.id ?? '')}`,
        verify: async (token: string) => {
          const match = token.match(/mock_token_(\d+)/)
          return match ? { id: Number.parseInt(match[1], 10) } : null
        },
      })

      FriendService(app)

      sqlite.exec(`
        INSERT INTO users (id, username, avatar, permission, openid)
        VALUES
          (1, 'admin', 'admin.png', 1, 'gh_admin'),
          (2, 'regular', 'regular.png', 0, 'gh_regular')
      `)
    })

    afterEach(() => {
      cleanupTestDB(sqlite)
    })

    it('serves list endpoint on /friend', async () => {
      const api = createTestClient(app, env)
      const result = await api.friend.list()

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(Array.isArray(result.data?.friend_list)).toBe(true)
    })

    it('allows admin-only accepted/sort_order updates without profile fields', async () => {
      sqlite.exec(`
        INSERT INTO friends (id, name, desc, avatar, url, uid, accepted, sort_order)
        VALUES (1, 'Example', 'Example desc', 'avatar.png', 'https://example.com', 2, 0, 0)
      `)

      const api = createTestClient(app, env)
      const result = await api.friend.update(
        1,
        {
          accepted: 1,
          sort_order: 9,
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeUndefined()

      const row = sqlite.query('SELECT name, desc, url, accepted, sort_order FROM friends WHERE id = 1').get() as {
        name: string
        desc: string
        url: string
        accepted: number
        sort_order: number
      } | null

      expect(row).not.toBeNull()
      expect(row?.name).toBe('Example')
      expect(row?.desc).toBe('Example desc')
      expect(row?.url).toBe('https://example.com')
      expect(row?.accepted).toBe(1)
      expect(row?.sort_order).toBe(9)
    })

    it('rejects incomplete core profile updates when only part of name/desc/url is provided', async () => {
      sqlite.exec(`
        INSERT INTO friends (id, name, desc, avatar, url, uid, accepted, sort_order)
        VALUES (1, 'Example', 'Example desc', 'avatar.png', 'https://example.com', 2, 0, 0)
      `)

      const api = createTestClient(app, env)
      const result = await api.friend.update(
        1,
        {
          name: 'Only name provided',
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(400)
    })
  })
}
