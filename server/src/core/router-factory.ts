import type { Router } from './router-contract'
import { createHonoRouter } from './router-hono'

type RouterFactoryDeps = {
  createHono: () => Router
}

const defaultDeps: RouterFactoryDeps = {
  createHono: createHonoRouter,
}

export function createRouterWithFactory(_env?: Env, deps: RouterFactoryDeps = defaultDeps): Router {
  return deps.createHono()
}
