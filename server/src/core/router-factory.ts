import type { Router, RouterImpl } from './router-contract'
import { createHonoRouter } from './router-hono'
import { createLegacyRouter } from './router-legacy'

const VALID_IMPLS: RouterImpl[] = ['legacy', 'hono']

type RouterFactoryDeps = {
  createHono: () => Router
  createLegacy: () => Router
}

const defaultDeps: RouterFactoryDeps = {
  createHono: createHonoRouter,
  createLegacy: createLegacyRouter,
}

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
    console.warn(`[router] Invalid ROUTER_IMPL "${raw}", falling back to hono.`)
  }

  return 'hono'
}

export function createRouterWithFactory(env?: Env, deps: RouterFactoryDeps = defaultDeps): Router {
  const impl = resolveRouterImpl(env)
  switch (impl) {
    case 'hono':
      return deps.createHono()
    case 'legacy':
      return deps.createLegacy()
    default: {
      const exhaustiveCheck: never = impl
      throw new Error(`[router] Unsupported router implementation: ${exhaustiveCheck}`)
    }
  }
}
