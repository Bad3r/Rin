import { describe, expect, it } from 'vitest'
import worker from '../../src/_worker'
import { createMockEnv } from '../fixtures'

type RouterImpl = 'legacy' | 'hono'
const ROUTER_IMPLS: RouterImpl[] = ['legacy', 'hono']

for (const impl of ROUTER_IMPLS) {
  describe(`Worker routing (${impl})`, () => {
    it('strips /api prefix before routing service handlers', async () => {
      const env = createMockEnv({ ROUTER_IMPL: impl })

      const response = await worker.fetch(new Request('http://localhost/api/auth/status'), env)
      expect(response.status).toBe(200)

      const payload = await response.json()
      expect(payload).toEqual({
        github: true,
        password: false,
      })
    })

    it('returns API 404 when service path is unknown', async () => {
      const env = createMockEnv({ ROUTER_IMPL: impl })

      const response = await worker.fetch(new Request('http://localhost/api/nope'), env)
      expect(response.status).toBe(404)
      // This assertion covers worker-level routing fallback, not router-level JSON NOT_FOUND payloads.
      expect(await response.text()).toBe('Not Found')
    })

    it('serves SPA index fallback for non-api routes via ASSETS', async () => {
      const env = createMockEnv({
        ROUTER_IMPL: impl,
        ASSETS: {
          fetch: async (request: Request) => {
            const path = new URL(request.url).pathname
            if (path === '/') {
              return new Response('<html>index</html>', {
                status: 200,
                headers: {
                  'Content-Type': 'text/html',
                },
              })
            }
            return new Response('missing', { status: 404 })
          },
        } as unknown as Fetcher,
      })

      const response = await worker.fetch(new Request('http://localhost/app/dashboard'), env)
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('index')
    })
  })
}
