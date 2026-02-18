import { act } from 'react'
import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function mockMatchMedia() {
  return vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

const describeWithDom = typeof document !== 'undefined' ? describe : describe.skip

describeWithDom('app bootstrap smoke', () => {
  const originalFetch = globalThis.fetch
  const originalMatchMedia = globalThis.matchMedia

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      value: originalFetch,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(globalThis, 'matchMedia', {
      value: originalMatchMedia,
      configurable: true,
      writable: true,
    })
    document.head.querySelectorAll('[data-rin-helmet]').forEach(element => {
      element.remove()
    })
    document.body.innerHTML = ''
  })

  it('mounts the app into the real root element', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    Object.defineProperty(globalThis, 'matchMedia', {
      value: mockMatchMedia(),
      configurable: true,
      writable: true,
    })

    Object.defineProperty(globalThis, 'fetch', {
      value: vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

        if (url.includes('/locales/')) {
          return new Response('{}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        if (url.includes('/api/user/profile')) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        if (url.includes('/api/config/client')) {
          return new Response(
            JSON.stringify({
              name: 'Rin',
              avatar: '/favicon',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (url.includes('/api/feed')) {
          return new Response(
            JSON.stringify({
              size: 0,
              data: [],
              hasNext: false,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
      configurable: true,
      writable: true,
    })

    await act(async () => {
      await import('../main')
    })

    await waitFor(() => {
      const root = document.getElementById('root')
      expect(root?.children.length).toBeGreaterThan(0)
    })

    const globalBoundaryErrorCall = consoleErrorSpy.mock.calls.find(call => {
      return typeof call[0] === 'string' && call[0].includes('Global Error Boundary caught an error:')
    })
    expect(globalBoundaryErrorCall).toBeUndefined()

    consoleErrorSpy.mockRestore()
  })
})
