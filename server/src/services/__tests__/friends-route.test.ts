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
        getOrSet: async (_key: string, fn: Function) => fn(),
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
        sign: async (_payload: unknown) => 'token',
        verify: async (_token: string) => null,
      })

      FriendService(app)
    })

    afterEach(() => {
      cleanupTestDB(sqlite)
    })

    it('serves list endpoint on /friend', async () => {
      const api = createTestClient(app, env)
      const result = await api.friend.list()

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(Array.isArray((result.data as any).friend_list)).toBe(true)
    })
  })
}
