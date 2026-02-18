import { generateRequestId, handleError } from './error-handler'
import { Router } from './router-contract'
import type { Context, Handler, Middleware, RouteDefinition } from './types'

type ParsedQueryValue = string | string[]

interface SchemaPropertyDefinition {
  type?: 'string' | 'number' | 'boolean' | 'array'
  optional?: boolean
}

interface ValidationSchema {
  type?: string
  properties?: Record<string, SchemaPropertyDefinition>
}

export class LegacyRouterAdapter extends Router {
  private routes: Map<string, RouteDefinition[]> = new Map()
  private middlewares: Middleware[] = []
  private appState: Map<string, unknown> = new Map()

  use(middleware: Middleware): this {
    this.middlewares.push(middleware)
    return this
  }

  state<T>(key: string, value: T): this
  state<T>(key: string): T | undefined
  state<T>(key: string, ...rest: [] | [T]): this | T | undefined {
    if (rest.length === 1) {
      this.appState.set(key, rest[0])
      return this
    }
    return this.appState.get(key) as T | undefined
  }

  private addRoute(method: string, path: string, handler: Handler, schema?: unknown): this {
    if (!this.routes.has(method)) {
      this.routes.set(method, [])
    }
    this.routes.get(method)?.push({ path, handler, schema })
    return this
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
    const groupRouter = new LegacyRouterAdapter()
    groupRouter.middlewares = [...this.middlewares]
    groupRouter.appState = this.appState
    callback(groupRouter)

    // Merge group routes with prefix
    for (const [method, routes] of groupRouter.routes) {
      if (!this.routes.has(method)) {
        this.routes.set(method, [])
      }
      for (const route of routes) {
        this.routes.get(method)?.push({
          path: prefix + route.path,
          handler: route.handler,
          schema: route.schema,
        })
      }
    }
    return this
  }

  private matchRoute(
    method: string,
    pathname: string
  ): { route: RouteDefinition; params: Record<string, string> } | null {
    const routes = this.routes.get(method)
    if (!routes) return null

    for (const route of routes) {
      const params = this.extractParams(route.path, pathname)
      if (params !== null) {
        return { route, params }
      }
    }
    return null
  }

  private extractParams(routePath: string, pathname: string): Record<string, string> | null {
    const routeParts = routePath.split('/').filter(Boolean)
    const pathParts = pathname.split('/').filter(Boolean)

    if (routeParts.length !== pathParts.length) return null

    const params: Record<string, string> = {}
    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i]
      const pathPart = pathParts[i]

      if (routePart.startsWith(':')) {
        try {
          params[routePart.slice(1)] = decodeURIComponent(pathPart)
        } catch {
          params[routePart.slice(1)] = pathPart
        }
      } else if (routePart !== pathPart) {
        return null
      }
    }
    return params
  }

  private parseQuery(searchParams: URLSearchParams): Record<string, ParsedQueryValue> {
    const query: Record<string, ParsedQueryValue> = {}
    searchParams.forEach((value, key) => {
      if (key in query) {
        if (Array.isArray(query[key])) {
          query[key].push(value)
        } else {
          query[key] = [query[key], value]
        }
      } else {
        query[key] = value
      }
    })
    return query
  }

  private async parseBody(request: Request): Promise<Record<string, unknown>> {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const jsonBody = await request.json()
      if (jsonBody && typeof jsonBody === 'object') {
        return jsonBody as Record<string, unknown>
      }
      return {}
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      const body: Record<string, FormDataEntryValue> = {}
      formData.forEach((value, key) => {
        body[key] = value
      })
      return body
    }

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const body: Record<string, unknown> = {}
      formData.forEach((value, key) => {
        body[key] = value
      })
      return body
    }

    return {}
  }

  private validateSchema(schema: unknown, data: unknown): { valid: boolean; errors?: string[] } {
    if (!schema || typeof schema !== 'object') return { valid: true }

    const typedSchema = schema as ValidationSchema

    // Simple TypeBox-like validation
    if (typedSchema.type === 'object' && typedSchema.properties) {
      const errors: string[] = []
      const dataRecord = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
      for (const [key, propSchema] of Object.entries(typedSchema.properties)) {
        const prop = propSchema as SchemaPropertyDefinition
        const value = dataRecord[key]

        if (prop.type === 'string' && value !== undefined && typeof value !== 'string') {
          errors.push(`${key} must be a string`)
        }
        if (prop.type === 'number' && value !== undefined && typeof value !== 'number') {
          errors.push(`${key} must be a number`)
        }
        if (prop.type === 'boolean' && value !== undefined && typeof value !== 'boolean') {
          errors.push(`${key} must be a boolean`)
        }
        if (prop.type === 'array' && value !== undefined && !Array.isArray(value)) {
          errors.push(`${key} must be an array`)
        }
        if (!prop.optional && value === undefined) {
          errors.push(`${key} is required`)
        }
      }
      return { valid: errors.length === 0, errors }
    }

    return { valid: true }
  }

  private createContext(request: Request, env: Env, params: Record<string, string>): Context {
    const url = new URL(request.url)
    const context: Context = {
      request,
      url,
      params,
      query: this.parseQuery(url.searchParams),
      headers: {},
      body: {},
      store: Object.fromEntries(this.appState.entries()) as Context['store'],
      set: {
        status: 200,
        headers: new Headers(),
      },
      cookie: {},
      jwt: this.appState.get('jwt') as Context['jwt'],
      oauth2: this.appState.get('oauth2') as Context['oauth2'],
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
      for (const middleware of this.middlewares) {
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

  async handle(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const method = request.method
    const pathname = url.pathname
    const requestId = generateRequestId()

    // Route preflight through the shared middleware chain.
    if (method === 'OPTIONS') {
      const preflightContext = this.createContext(request, env, {})
      const preflightResponse = await this.runMiddlewares(preflightContext, env, requestId)
      if (preflightResponse) {
        return preflightResponse
      }
    }

    // Find matching route
    const match = this.matchRoute(method, pathname)
    if (!match) {
      const errorResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${method} ${pathname} not found`,
          requestId,
        },
      }
      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { route, params } = match

    // Build context
    const context = this.createContext(request, env, params)

    // Parse body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        context.body = await this.parseBody(request)
      } catch (_e) {
        // Body parsing failed, return structured error
        const { ValidationError } = await import('../errors')
        return handleError(new ValidationError('Invalid request body format'), context, requestId)
      }
    }

    // Validate schema
    if (route.schema) {
      const validation = this.validateSchema(route.schema, context.body)
      if (!validation.valid) {
        const { ValidationError } = await import('../errors')
        const details = validation.errors?.map(msg => ({ message: msg }))
        return handleError(new ValidationError('Validation failed', details), context, requestId)
      }
    }

    // Run middlewares
    const middlewareResponse = await this.runMiddlewares(context, env, requestId)
    if (middlewareResponse) {
      return middlewareResponse
    }

    // Run handler
    try {
      const result = await route.handler(context)

      // Handle different response types
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
}

export function createLegacyRouter(): Router {
  return new LegacyRouterAdapter()
}
