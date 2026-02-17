const globalState = globalThis as typeof globalThis & {
  __rin_no_network_guard_installed__?: boolean
}

const allowRemote =
  process.env.RIN_TEST_ALLOW_REMOTE === 'true' ||
  process.env.RIN_TEST_TIER === 'remote' ||
  process.env.ENABLE_REMOTE_INTEGRATION_TESTS === 'true'

function resolveUrl(input: RequestInfo | URL): URL | null {
  if (input instanceof URL) {
    return input
  }

  if (input instanceof Request) {
    return new URL(input.url)
  }

  if (typeof input === 'string') {
    try {
      return new URL(input)
    } catch {
      // Relative request paths are treated as local by default in tests.
      return new URL(input, 'http://localhost')
    }
  }

  return null
}

function isLoopbackHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  return lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower.endsWith('.localhost')
}

if (!allowRemote && !globalState.__rin_no_network_guard_installed__) {
  const originalFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // NOTE: This guard only intercepts `fetch`. Other network primitives
    // (for example WebSocket/Bun.connect/Node http|https) are not blocked here.
    const url = resolveUrl(input)

    if (url && (url.protocol === 'http:' || url.protocol === 'https:')) {
      if (!isLoopbackHostname(url.hostname)) {
        throw new Error(
          `[test-network-guard] Blocked outbound fetch to ${url.origin}. ` +
            `Use local mocks or move this case to server/tests/remote/.`
        )
      }
    }

    return originalFetch(input, init)
  }

  globalState.__rin_no_network_guard_installed__ = true
}
