import { beforeEach, describe, expect, it } from 'bun:test'
import { createMockEnv } from '../../../tests/fixtures'
import { createBaseApp } from '../base'

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

      const response = await app.handle(new Request('http://localhost/slash/'), env)
      expect(response.status).toBe(200)
      const payload = (await response.json()) as { ok: boolean }
      expect(payload).toEqual({ ok: true })
    })

    it('keeps repeated query keys as arrays', async () => {
      app.get('/query', ctx => ctx.query)

      const response = await app.handle(new Request('http://localhost/query?tag=security&tag=edge&limit=5'), env)

      expect(response.status).toBe(200)
      const payload = (await response.json()) as { tag: string[]; limit: string }
      expect(payload).toEqual({
        tag: ['security', 'edge'],
        limit: '5',
      })
    })

    it('decodes encoded path values consistently across adapters', async () => {
      app.get('/tag/:name', ctx => ({ name: ctx.params.name }))

      const response = await app.handle(new Request('http://localhost/tag/hello%20world'), env)
      expect(response.status).toBe(200)
      const payload = (await response.json()) as { name: string }
      expect(payload).toEqual({ name: 'hello world' })
    })

    it('returns router-level OPTIONS preflight with shared CORS header contract', async () => {
      const response = await app.handle(new Request('http://localhost/unknown', { method: 'OPTIONS' }), env)

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, PATCH, OPTIONS')
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('content-type, authorization, x-csrf-token')
      expect(response.headers.get('Access-Control-Max-Age')).toBe('600')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    it('keeps non-OPTIONS CORS middleware header contract', async () => {
      app.get('/cors', () => ({ ok: true }))

      const response = await app.handle(
        new Request('http://localhost/cors', {
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
      const response = await app.handle(new Request('http://localhost/not-found'), env)

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
