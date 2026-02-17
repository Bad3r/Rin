import type { Router } from './router-contract'
import { createRouterWithFactory } from './router-factory'

export type { RouterImpl, RouterLike } from './router-contract'
export { Router } from './router-contract'

export function createRouter(env?: Env): Router {
  return createRouterWithFactory(env)
}
