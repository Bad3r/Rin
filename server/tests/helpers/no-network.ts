import { shouldAllowRemoteNetwork } from './network-guard'

const globalState = globalThis as typeof globalThis & {
  __rin_no_network_guard_installed__?: boolean
}

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
      return new URL(input, 'http://localhost')
    }
  }

  return null
}

function isLoopbackHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  return lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower.endsWith('.localhost')
}

if (!shouldAllowRemoteNetwork() && !globalState.__rin_no_network_guard_installed__) {
  const originalFetch = globalThis.fetch.bind(globalThis)

  // Worker-runtime outbound requests are guarded by Miniflare outboundService.
  // This setup guard covers direct test-runner fetches (for example utility jobs).
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveUrl(input)
    if (url && (url.protocol === 'http:' || url.protocol === 'https:') && !isLoopbackHostname(url.hostname)) {
      throw new Error(
        `[test-network-guard] Blocked outbound fetch to ${url.origin}. ` +
          `Use local mocks or move this case to server/tests/remote/.`
      )
    }
    return originalFetch(input, init)
  }

  globalState.__rin_no_network_guard_installed__ = true
}
