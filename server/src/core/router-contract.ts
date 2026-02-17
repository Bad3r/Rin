import type { Handler, Middleware } from './types'

export type RouterImpl = 'legacy' | 'hono'

export interface RouterLike {
  use(middleware: Middleware): this

  state<T>(key: string, value: T): this
  state<T>(key: string): T | undefined

  get(path: string, handler: Handler, schema?: unknown): this
  post(path: string, handler: Handler, schema?: unknown): this
  put(path: string, handler: Handler, schema?: unknown): this
  delete(path: string, handler: Handler, schema?: unknown): this
  patch(path: string, handler: Handler, schema?: unknown): this

  group(prefix: string, callback: (router: Router) => void): this

  handle(request: Request, env: Env): Promise<Response>
  fetch(request: Request, env: Env): Promise<Response>
}

// Runtime compatibility export: services currently import `Router` as a value.
export abstract class Router implements RouterLike {
  abstract use(middleware: Middleware): this

  abstract state<T>(key: string, value: T): this
  abstract state<T>(key: string): T | undefined

  abstract get(path: string, handler: Handler, schema?: unknown): this
  abstract post(path: string, handler: Handler, schema?: unknown): this
  abstract put(path: string, handler: Handler, schema?: unknown): this
  abstract delete(path: string, handler: Handler, schema?: unknown): this
  abstract patch(path: string, handler: Handler, schema?: unknown): this

  abstract group(prefix: string, callback: (router: Router) => void): this

  abstract handle(request: Request, env: Env): Promise<Response>

  fetch(request: Request, env: Env): Promise<Response> {
    return this.handle(request, env)
  }
}
