import type { WorkerOptions } from 'miniflare'

export function shouldAllowRemoteNetwork(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.RIN_TEST_ALLOW_REMOTE === 'true' ||
    env.RIN_TEST_TIER === 'remote' ||
    env.ENABLE_REMOTE_INTEGRATION_TESTS === 'true'
  )
}

function isLoopbackHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  return lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower.endsWith('.localhost')
}

export function createOutboundServiceGuard(
  env: NodeJS.ProcessEnv = process.env
): WorkerOptions['outboundService'] | undefined {
  if (shouldAllowRemoteNetwork(env)) {
    return undefined
  }

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !isLoopbackHostname(url.hostname)) {
      throw new Error(
        `[test-network-guard] Blocked outbound fetch to ${url.origin}. ` +
          `Use local mocks or move this case to server/tests/remote/.`
      )
    }
    return fetch(request)
  }
}
