import { beforeAll, describe, expect, it } from 'vitest'
import worker from '../../src/_worker'
import { createApp } from '../../src/server'
import { createMockEnv } from '../fixtures'

const TEST_ORIGIN = 'https://example.test'

describe('Worker routing (hono)', () => {
  beforeAll(async () => {
    // Warm dynamic service imports once.
    // Coverage instrumentation can make first-load path significantly slower.
    await createApp(createMockEnv(), '/auth/status')
  })

  it('strips /api prefix before routing service handlers', async () => {
    const response = await worker.fetch(new Request(`${TEST_ORIGIN}/api/auth/status`), createMockEnv())
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload).toEqual({
      github: true,
      password: false,
    })
  })

  it('returns API 404 when service path is unknown', async () => {
    const response = await worker.fetch(new Request(`${TEST_ORIGIN}/api/nope`), createMockEnv())
    expect(response.status).toBe(404)
    // This assertion covers worker-level routing fallback, not router-level JSON NOT_FOUND payloads.
    expect(await response.text()).toBe('Not Found')
  })

  it('serves SPA index fallback for non-api routes via ASSETS', async () => {
    const response = await worker.fetch(
      new Request(`${TEST_ORIGIN}/app/dashboard`),
      createMockEnv({
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
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('index')
  })
})
