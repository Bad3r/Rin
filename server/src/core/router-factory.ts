import type { Router, RouterImpl } from './router-contract'
import { createHonoRouter } from './router-hono'
import { createLegacyRouter } from './router-legacy'

const VALID_IMPLS: RouterImpl[] = ['legacy', 'hono']

function normalizeRouterImpl(value?: string): RouterImpl | undefined {
  if (!value) {
    return undefined
  }
  if ((VALID_IMPLS as string[]).includes(value)) {
    return value as RouterImpl
  }
  return undefined
}

export function resolveRouterImpl(env?: Partial<Env>): RouterImpl {
  const envImpl = normalizeRouterImpl(env?.ROUTER_IMPL)
  if (envImpl) {
    return envImpl
  }

  const raw = env?.ROUTER_IMPL
  if (raw) {
    console.warn(`[router] Invalid ROUTER_IMPL "${raw}", falling back to legacy.`)
  }

  return 'legacy'
}

export function createRouterWithFactory(env?: Env): Router {
  const impl = resolveRouterImpl(env)
  if (impl === 'hono') {
    return createHonoRouter()
  }
  return createLegacyRouter()
}
