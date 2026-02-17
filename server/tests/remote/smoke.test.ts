import { describe, expect, it } from 'bun:test'

const baseUrlEnv = process.env.RIN_REMOTE_BASE_URL

if (!baseUrlEnv) {
  throw new Error(
    '[remote-tests] RIN_REMOTE_BASE_URL is required. ' +
      'Set ENABLE_REMOTE_INTEGRATION_TESTS=true and provide a deployment URL.'
  )
}

const baseUrl = new URL(baseUrlEnv)
const timeoutMs = Number(process.env.RIN_REMOTE_TIMEOUT_MS || '10000')

function makeUrl(path: string): string {
  return new URL(path, baseUrl).toString()
}

async function fetchWithTimeout(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(`Timeout after ${timeoutMs}ms`), timeoutMs)

  try {
    return await fetch(makeUrl(path), { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

describe('Remote smoke', () => {
  it('serves rss.xml with xml content type', async () => {
    const response = await fetchWithTimeout('/rss.xml')

    expect(response.status).toBe(200)
    const contentType = response.headers.get('content-type') || ''
    expect(contentType).toContain('xml')

    const body = await response.text()
    expect(body.includes('<rss') || body.includes('<feed')).toBe(true)
  })

  it('returns auth status contract', async () => {
    const response = await fetchWithTimeout('/api/auth/status')

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { github: boolean; password: boolean }
    expect(typeof payload.github).toBe('boolean')
    expect(typeof payload.password).toBe('boolean')
  })

  it('returns 404 for unknown api routes', async () => {
    const unknownPath = `/api/remote-smoke-not-found-${Date.now()}`
    const response = await fetchWithTimeout(unknownPath)

    expect(response.status).toBe(404)
  })
})
