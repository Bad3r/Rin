import { beforeEach, describe, expect, it } from 'vitest'
import { createMockEnv } from '../../../tests/fixtures'
import { createBaseApp } from '../base'
import { createRouter } from '../router'

type RouterImpl = 'legacy' | 'hono'

const ROUTER_IMPLS: RouterImpl[] = ['legacy', 'hono']

for (const impl of ROUTER_IMPLS) {
  describe(`Router compatibility parity (${impl})`, () => {
    let env: Env
    let app: ReturnType<typeof createBaseApp>

    beforeEach(() => {
      env = createMockEnv({ ROUTER_IMPL: impl })
      app = createBaseApp(env)
    })

    it('normalizes trailing slash routes (/x == /x/)', async () => {
      app.get('/slash', () => ({ ok: true }))

      const response = await app.handle(new Request('https://example.test/slash/'), env)
      expect(response.status).toBe(200)
      const payload = (await response.json()) as { ok: boolean }
      expect(payload).toEqual({ ok: true })
    })

    it('keeps repeated query keys as arrays', async () => {
      app.get('/query', ctx => ctx.query)

      const response = await app.handle(new Request('https://example.test/query?tag=security&tag=edge&limit=5'), env)

      expect(response.status).toBe(200)
      const payload = (await response.json()) as { tag: string[]; limit: string }
      expect(payload).toEqual({
        tag: ['security', 'edge'],
        limit: '5',
      })
    })

    it('keeps unsupported content types as empty object body', async () => {
      app.post('/body', ctx => ctx.body)

      const response = await app.handle(
        new Request('https://example.test/body', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: 'plain-text payload',
        }),
        env
      )

      expect(response.status).toBe(200)
      const payload = (await response.json()) as Record<string, unknown>
      expect(payload).toEqual({})
    })

    it('propagates state mutations made after group registration', async () => {
      const rawApp = createRouter(env)
      rawApp.group('/state', group => {
        group.get('/check', ctx => ({ routerMode: ctx.store.routerMode }))
      })

      rawApp.state('routerMode', 'after-group')

      const response = await rawApp.handle(new Request('https://example.test/state/check'), env)
      expect(response.status).toBe(200)
      const payload = (await response.json()) as { routerMode: string }
      expect(payload).toEqual({ routerMode: 'after-group' })
    })

    it('decodes encoded path values consistently across adapters', async () => {
      app.get('/tag/:name', ctx => ({ name: ctx.params.name }))

      const response = await app.handle(new Request('https://example.test/tag/hello%20world'), env)
      expect(response.status).toBe(200)
      const payload = (await response.json()) as { name: string }
      expect(payload).toEqual({ name: 'hello world' })
    })

    it('returns router-level OPTIONS preflight with shared CORS header contract', async () => {
      const response = await app.handle(new Request('https://example.test/unknown', { method: 'OPTIONS' }), env)

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, PATCH, OPTIONS')
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('content-type, authorization, x-csrf-token')
      expect(response.headers.get('Access-Control-Max-Age')).toBe('600')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    it('routes router-level OPTIONS through router middleware', async () => {
      const rawApp = createRouter(env)
      rawApp.use(async ctx => {
        if (ctx.request.method === 'OPTIONS') {
          ctx.set.headers.set('x-preflight-source', 'middleware')
          return new Response(null, { status: 204, headers: ctx.set.headers })
        }
        return undefined
      })

      const response = await rawApp.handle(new Request('https://example.test/unknown', { method: 'OPTIONS' }), env)

      expect(response.status).toBe(204)
      expect(response.headers.get('x-preflight-source')).toBe('middleware')
    })

    it('keeps non-OPTIONS CORS middleware header contract', async () => {
      app.get('/cors', () => ({ ok: true }))

      const response = await app.handle(
        new Request('https://example.test/cors', {
          headers: { Origin: 'https://example.com' },
        }),
        env
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('content-type, authorization, x-csrf-token')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    it('keeps not-found payload shape contract', async () => {
      const response = await app.handle(new Request('https://example.test/not-found'), env)

      expect(response.status).toBe(404)
      const payload = (await response.json()) as {
        success: boolean
        error: { code: string; message: string; requestId?: string }
      }

      expect(payload.success).toBe(false)
      expect(payload.error.code).toBe('NOT_FOUND')
      expect(payload.error.message).toBe('Route GET /not-found not found')
      expect(typeof payload.error.requestId).toBe('string')
      expect((payload.error.requestId || '').length).toBeGreaterThan(5)
    })
  })
}
