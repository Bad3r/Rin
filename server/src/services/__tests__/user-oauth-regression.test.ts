import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTestDB, createMockDB, createMockEnv, execSql } from '../../../tests/fixtures'
import { createBaseApp } from '../../core/base'
import type { Context } from '../../core/types'
import { UserService } from '../user'

type RouterImpl = 'legacy' | 'hono'

const ROUTER_IMPLS: RouterImpl[] = ['legacy', 'hono']
const TEST_ORIGIN = 'https://example.test'

for (const impl of ROUTER_IMPLS) {
  describe(`User OAuth regression (${impl})`, () => {
    let env: Env
    let app: ReturnType<typeof createBaseApp>
    let sqlite: D1Database

    beforeEach(() => {
      const mockDB = createMockDB()
      sqlite = mockDB.sqlite

      env = createMockEnv({
        ROUTER_IMPL: impl,
        RIN_GITHUB_CLIENT_ID: '',
        RIN_GITHUB_CLIENT_SECRET: '',
        RIN_ALLOWED_REDIRECT_ORIGINS: 'https://frontend.example.com',
      })

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
        sign: async (payload: { id: number }) => `jwt_${payload.id}`,
        verify: async (_token: string) => null,
      })
      app.state('oauth2', {
        generateState: () => 'state-123',
        createRedirectUrl: (state: string, _provider: string) =>
          `https://github.com/login/oauth/authorize?state=${state}`,
        authorize: async (_provider: string, _code: string) => ({ accessToken: 'gh-token' }),
      })
      app.use(async ctx => {
        const oauth2 = app.state('oauth2') as Context['oauth2'] | undefined
        if (!oauth2) {
          return undefined
        }
        ctx.oauth2 = oauth2
        ctx.store.oauth2 = oauth2
        return undefined
      })

      UserService(app)
    })

    afterEach(async () => {
      await cleanupTestDB(sqlite)
    })

    it('GET /user/github requires referer header', async () => {
      const response = await app.handle(new Request(`${TEST_ORIGIN}/user/github`), env)
      expect(response.status).toBe(400)

      const payload = (await response.json()) as {
        success: boolean
        error: { code: string; message: string }
      }
      expect(payload.success).toBe(false)
      expect(payload.error.code).toBe('BAD_REQUEST')
    })

    it('GET /user/github sets cookies and redirects', async () => {
      const response = await app.handle(
        new Request(`${TEST_ORIGIN}/user/github`, {
          headers: {
            Referer: 'https://frontend.example.com/feed/42',
          },
        }),
        env
      )

      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('https://github.com/login/oauth/authorize?state=state-123')

      const setCookie = response.headers.get('Set-Cookie') || ''
      expect(setCookie).toContain('state=state-123')
      expect(setCookie).toContain('redirect_to=https%3A%2F%2Ffrontend.example.com%2Fcallback')
    })

    it('GET /user/github/callback rejects mismatched state', async () => {
      const response = await app.handle(
        new Request(`${TEST_ORIGIN}/user/github/callback?state=mismatch&code=abc`, {
          headers: {
            Cookie: 'state=state-123; redirect_to=https%3A%2F%2Ffrontend.example.com%2Fcallback',
          },
        }),
        env
      )

      expect(response.status).toBe(400)
      const payload = (await response.json()) as {
        success: boolean
        error: { code: string; message: string }
      }
      expect(payload.error.code).toBe('BAD_REQUEST')
      expect(payload.error.message).toBe('Invalid state parameter')
    })

    it('GET /user/github/callback rejects redirect targets outside allowlist', async () => {
      const response = await app.handle(
        new Request(`${TEST_ORIGIN}/user/github/callback?state=state-123&code=abc`, {
          headers: {
            Cookie: 'state=state-123; redirect_to=https%3A%2F%2Fattacker.example%2Fcallback',
          },
        }),
        env
      )

      expect(response.status).toBe(400)
      const payload = (await response.json()) as {
        success: boolean
        error: { code: string; message: string }
      }
      expect(payload.error.code).toBe('BAD_REQUEST')
      expect(payload.error.message).toBe('Invalid redirect origin')
    })

    it('GET /user/github/callback validates state and propagates token to redirect URL', async () => {
      await execSql(
        sqlite,
        `
        INSERT INTO users (id, username, avatar, openid, permission)
        VALUES (7, 'oauth-user', 'avatar.png', '12345', 0)
      `
      )

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            id: '12345',
            login: 'oauth-user',
            name: 'OAuth User',
            avatar_url: 'https://avatars.example.com/u/12345',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      })

      try {
        const response = await app.handle(
          new Request(`${TEST_ORIGIN}/user/github/callback?state=state-123&code=abc`, {
            headers: {
              Cookie: 'state=state-123; redirect_to=https%3A%2F%2Ffrontend.example.com%2Fcallback',
            },
          }),
          env
        )

        expect(response.status).toBe(302)
        expect(fetchSpy).toHaveBeenCalled()
        const location = response.headers.get('Location') || ''
        expect(location).toContain('https://frontend.example.com/callback')
        expect(location).toContain('token=jwt_7')

        const setCookie = response.headers.get('Set-Cookie') || ''
        expect(setCookie).toContain('state=')
        expect(setCookie).toContain('token=jwt_7')
      } finally {
        fetchSpy.mockRestore()
      }
    })
  })
}
