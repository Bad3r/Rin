import type { DB } from '../server'
import type { CacheImpl } from '../utils/cache'

export interface ContextStore {
  db: DB
  env: Env
  cache: CacheImpl
  serverConfig: CacheImpl
  clientConfig: CacheImpl
  jwt: JWTUtils
  oauth2?: OAuth2Utils
  anyUser: (db: DB) => Promise<boolean>
  [key: string]: unknown
}

// Type definitions for the lightweight framework

export interface Context {
  request: Request
  url: URL
  params: Record<string, string>
  query: Record<string, string | string[]>
  headers: Record<string, string>
  body: Record<string, unknown>
  store: ContextStore
  set: {
    status: number
    headers: Headers
  }
  cookie: Record<string, CookieValue>
  jwt?: JWTUtils
  oauth2?: OAuth2Utils
  uid?: number
  admin: boolean
  username?: string
  env: Env
}

export interface CookieValue {
  value: string
  expires?: Date
  path?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  set(options: {
    value: string
    expires?: Date
    path?: string
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
  }): void
}

export interface JWTUtils {
  sign(payload: Record<string, unknown>): Promise<string>
  verify(token: string): Promise<Record<string, unknown> | null>
}

export interface OAuth2Utils {
  generateState(): string
  createRedirectUrl(state: string, provider: string): string
  authorize(provider: string, code: string): Promise<{ accessToken: string } | null>
}

export type Handler = (context: Context) => Promise<unknown> | unknown
export type Middleware = (
  context: Context,
  env: Env,
  container?: unknown
) => Promise<Response | undefined | undefined> | Response | undefined | undefined

export interface RouteDefinition {
  path: string
  handler: Handler
  schema?: unknown
}

// Schema types (TypeBox compatible)
export const t = {
  Object: (properties: Record<string, unknown>, options?: { additionalProperties?: boolean }) => ({
    type: 'object',
    properties,
    ...options,
  }),
  String: (options?: { optional?: boolean }) => ({ type: 'string', optional: options?.optional }),
  Number: (options?: { optional?: boolean }) => ({ type: 'number', optional: options?.optional }),
  Boolean: (options?: { optional?: boolean }) => ({ type: 'boolean', optional: options?.optional }),
  Integer: (options?: { optional?: boolean }) => ({ type: 'number', optional: options?.optional }),
  Date: (options?: { optional?: boolean }) => ({ type: 'string', format: 'date-time', optional: options?.optional }),
  Array: (items: unknown, options?: { optional?: boolean }) => ({ type: 'array', items, optional: options?.optional }),
  File: (options?: { optional?: boolean }) => ({ type: 'file', optional: options?.optional }),
  Optional: (schema: Record<string, unknown>) => ({ ...schema, optional: true }),
  Numeric: (options?: { optional?: boolean }) => ({ type: 'number', optional: options?.optional }),
}
