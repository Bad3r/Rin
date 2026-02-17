import { Hono } from 'hono'
import { generateRequestId, handleError } from './error-handler'
import { Router } from './router-contract'
import type { Context, Handler, Middleware } from './types'

type AppStateValue = unknown

interface HonoRootState {
  app: Hono<{ Bindings: Env }>
  middlewares: Middleware[]
  appState: Map<string, AppStateValue>
  initialized: boolean
}

interface SchemaValidationResult {
  valid: boolean
  errors?: string[]
}

function buildNotFoundResponse(request: Request): Response {
  const url = new URL(request.url)
  const requestId = generateRequestId()
  const errorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${url.pathname} not found`,
      requestId,
    },
  }

  return new Response(JSON.stringify(errorResponse), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
}

function parseQuery(searchParams: URLSearchParams): Record<string, unknown> {
  const query: Record<string, unknown> = {}
  searchParams.forEach((value, key) => {
    if (key in query) {
      if (Array.isArray(query[key])) {
        ;(query[key] as string[]).push(value)
      } else {
        query[key] = [query[key], value]
      }
    } else {
      query[key] = value
    }
  })
  return query
}

async function parseBody(request: {
  headers: Headers
  json: () => Promise<unknown>
  formData: () => Promise<FormData>
  text: () => Promise<string>
}): Promise<unknown> {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return await request.json()
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData()
    const body: Record<string, unknown> = {}
    formData.forEach((value, key) => {
      body[key] = value
    })
    return body
  }

  if (contentType.includes('multipart/form-data')) {
    return await request.formData()
  }

  return await request.text()
}

function validateSchema(schema: unknown, data: unknown): SchemaValidationResult {
  if (!schema) {
    return { valid: true }
  }

  const objectSchema = schema as {
    type?: string
    properties?: Record<string, { type?: string; optional?: boolean }>
  }

  if (objectSchema.type === 'object' && objectSchema.properties) {
    const errors: string[] = []
    for (const [key, propSchema] of Object.entries(objectSchema.properties)) {
      const value = (data as Record<string, unknown> | undefined)?.[key]

      if (propSchema.type === 'string' && value !== undefined && typeof value !== 'string') {
        errors.push(`${key} must be a string`)
      }
      if (propSchema.type === 'number' && value !== undefined && typeof value !== 'number') {
        errors.push(`${key} must be a number`)
      }
      if (propSchema.type === 'boolean' && value !== undefined && typeof value !== 'boolean') {
        errors.push(`${key} must be a boolean`)
      }
      if (propSchema.type === 'array' && value !== undefined && !Array.isArray(value)) {
        errors.push(`${key} must be an array`)
      }
      if (!propSchema.optional && value === undefined) {
        errors.push(`${key} is required`)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  return { valid: true }
}

function normalizePrefix(prefix: string): string {
  if (!prefix) {
    return ''
  }

  const withLeadingSlash = prefix.startsWith('/') ? prefix : `/${prefix}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash
}

function joinPaths(prefix: string, path: string): string {
  const normalizedPrefix = normalizePrefix(prefix)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (!normalizedPrefix) {
    return normalizedPath
  }
  if (normalizedPath === '/') {
    return normalizedPrefix
  }

  return `${normalizedPrefix}${normalizedPath}`
}

export class HonoRouterAdapter extends Router {
  private rootState: HonoRootState
  private prefix: string

  constructor(rootState?: HonoRootState, prefix = '') {
    super()

    this.rootState = rootState ?? {
      app: new Hono<{ Bindings: Env }>({ strict: false }),
      middlewares: [],
      appState: new Map<string, AppStateValue>(),
      initialized: false,
    }
    this.prefix = prefix

    if (!this.rootState.initialized) {
      this.initializeRootHandlers()
      this.rootState.initialized = true
    }
  }

  private initializeRootHandlers(): void {
    this.rootState.app.use('*', async (c, next) => {
      if (c.req.method !== 'OPTIONS') {
        await next()
        return
      }

      const request = new Request(c.req.raw)
      const requestId = generateRequestId()
      const context = this.createContext(request, c.env, {})
      const middlewareResult = await this.runMiddlewares(context, c.env, requestId)
      if (middlewareResult) {
        return middlewareResult
      }

      await next()
    })

    this.rootState.app.notFound(c => buildNotFoundResponse(c.req.raw))
  }

  use(middleware: Middleware): this {
    this.rootState.middlewares.push(middleware)
    return this
  }

  state<T>(key: string, value: T): this
  state<T>(key: string): T | undefined
  state<T>(key: string, value?: T): this | T | undefined {
    if (arguments.length === 2) {
      this.rootState.appState.set(key, value as AppStateValue)
      return this
    }
    return this.rootState.appState.get(key) as T | undefined
  }

  get(path: string, handler: Handler, schema?: unknown): this {
    return this.addRoute('GET', path, handler, schema)
  }

  post(path: string, handler: Handler, schema?: unknown): this {
    return this.addRoute('POST', path, handler, schema)
  }

  put(path: string, handler: Handler, schema?: unknown): this {
    return this.addRoute('PUT', path, handler, schema)
  }

  delete(path: string, handler: Handler, schema?: unknown): this {
    return this.addRoute('DELETE', path, handler, schema)
  }

  patch(path: string, handler: Handler, schema?: unknown): this {
    return this.addRoute('PATCH', path, handler, schema)
  }

  group(prefix: string, callback: (router: Router) => void): this {
    const groupPrefix = joinPaths(this.prefix, prefix)
    const groupRouter = new HonoRouterAdapter(this.rootState, groupPrefix)
    callback(groupRouter)
    return this
  }

  async handle(request: Request, env: Env): Promise<Response> {
    return this.rootState.app.fetch(request, env)
  }

  private createContext(request: Request, env: Env, params: Record<string, string>): Context {
    const url = new URL(request.url)
    const context: Context = {
      request,
      url,
      params,
      query: parseQuery(url.searchParams),
      headers: {},
      body: null,
      store: Object.fromEntries(this.rootState.appState.entries()),
      set: {
        status: 200,
        headers: new Headers(),
      },
      cookie: {},
      jwt: this.rootState.appState.get('jwt') as Context['jwt'],
      oauth2: this.rootState.appState.get('oauth2') as Context['oauth2'],
      uid: undefined,
      admin: false,
      username: undefined,
      env,
    }

    request.headers.forEach((value, key) => {
      context.headers[key.toLowerCase()] = value
    })

    return context
  }

  private async runMiddlewares(context: Context, env: Env, requestId: string): Promise<Response | undefined> {
    try {
      for (const middleware of this.rootState.middlewares) {
        const result = await middleware(context, env)
        if (result instanceof Response) {
          return result
        }
      }
    } catch (error) {
      return handleError(error, context, requestId)
    }

    return undefined
  }

  private addRoute(method: string, path: string, handler: Handler, schema?: unknown): this {
    const fullPath = joinPaths(this.prefix, path)

    const wrappedHandler = async (request: Request, env: Env, params: Record<string, string>): Promise<Response> => {
      const requestId = generateRequestId()
      const context = this.createContext(request, env, params)

      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        try {
          context.body = await parseBody(request.clone())
        } catch {
          const { ValidationError } = await import('../errors')
          return handleError(new ValidationError('Invalid request body format'), context, requestId)
        }
      }

      if (schema) {
        const validation = validateSchema(schema, context.body)
        if (!validation.valid) {
          const { ValidationError } = await import('../errors')
          const details = validation.errors?.map(message => ({ message }))
          return handleError(new ValidationError('Validation failed', details), context, requestId)
        }
      }

      const middlewareResult = await this.runMiddlewares(context, env, requestId)
      if (middlewareResult) {
        return middlewareResult
      }

      try {
        const result = await handler(context)
        if (result instanceof Response) {
          return result
        }

        const headers = new Headers(context.set.headers)
        headers.set('Content-Type', 'application/json')
        return new Response(JSON.stringify(result), {
          status: context.set.status,
          headers,
        })
      } catch (error) {
        return handleError(error, context, requestId)
      }
    }

    if (method === 'GET') {
      this.rootState.app.get(fullPath, async c =>
        wrappedHandler(new Request(c.req.raw), c.env, Object.fromEntries(Object.entries(c.req.param())))
      )
      return this
    }
    if (method === 'POST') {
      this.rootState.app.post(fullPath, async c =>
        wrappedHandler(new Request(c.req.raw), c.env, Object.fromEntries(Object.entries(c.req.param())))
      )
      return this
    }
    if (method === 'PUT') {
      this.rootState.app.put(fullPath, async c =>
        wrappedHandler(new Request(c.req.raw), c.env, Object.fromEntries(Object.entries(c.req.param())))
      )
      return this
    }
    if (method === 'DELETE') {
      this.rootState.app.delete(fullPath, async c =>
        wrappedHandler(new Request(c.req.raw), c.env, Object.fromEntries(Object.entries(c.req.param())))
      )
      return this
    }
    if (method === 'PATCH') {
      this.rootState.app.patch(fullPath, async c =>
        wrappedHandler(new Request(c.req.raw), c.env, Object.fromEntries(Object.entries(c.req.param())))
      )
      return this
    }

    this.rootState.app.on(method, fullPath, async c =>
      wrappedHandler(new Request(c.req.raw), c.env, Object.fromEntries(Object.entries(c.req.param())))
    )
    return this
  }
}

export function createHonoRouter(): Router {
  return new HonoRouterAdapter()
}
