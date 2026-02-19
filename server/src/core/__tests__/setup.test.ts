import { describe, expect, it } from 'vitest'
import { deriveAuth } from '../setup'
import type { Context, JWTUtils } from '../types'

type UserRow = {
  id: number
  username: string
  permission: number
}

function createContext(options: {
  verify: (token: string) => Promise<Record<string, unknown> | null>
  findFirst: () => Promise<UserRow | undefined>
  authHeaderToken?: string
  cookieToken?: string
}): Context {
  const headers = new Headers()
  if (options.authHeaderToken) {
    headers.set('Authorization', `Bearer ${options.authHeaderToken}`)
  }

  const request = new Request('https://example.test/test', {
    headers,
  })

  const jwt: JWTUtils = {
    sign: async (_payload: Record<string, unknown>) => 'signed-token',
    verify: async (token: string) => options.verify(token),
  }

  return {
    request,
    url: new URL(request.url),
    params: {},
    query: {},
    headers: {},
    body: {},
    store: {
      db: {
        query: {
          users: {
            findFirst: async () => options.findFirst(),
          },
        },
      } as Context['store']['db'],
      env: {} as Env,
      cache: {} as Context['store']['cache'],
      serverConfig: {} as Context['store']['serverConfig'],
      clientConfig: {} as Context['store']['clientConfig'],
      jwt,
      anyUser: async (_db: Context['store']['db']) => false,
    },
    set: {
      status: 200,
      headers: new Headers(),
    },
    cookie: options.cookieToken
      ? {
          token: {
            value: options.cookieToken,
            set: (_options: {
              value: string
              expires?: Date
              path?: string
              httpOnly?: boolean
              secure?: boolean
              sameSite?: 'strict' | 'lax' | 'none'
            }) => {},
          },
        }
      : {},
    jwt,
    admin: false,
    env: {} as Env,
  }
}

describe('deriveAuth', () => {
  it('ignores non-numeric profile IDs without querying users', async () => {
    let queried = false
    const context = createContext({
      authHeaderToken: 'test-token',
      verify: async (_token: string) => ({ id: 'not-a-number' }),
      findFirst: async () => {
        queried = true
        return { id: 7, username: 'tester', permission: 1 }
      },
    })

    await deriveAuth(context)

    expect(queried).toBe(false)
    expect(context.uid).toBeUndefined()
    expect(context.username).toBeUndefined()
    expect(context.admin).toBe(false)
  })

  it('accepts numeric profile IDs and populates auth fields', async () => {
    let queried = false
    const context = createContext({
      authHeaderToken: 'test-token',
      verify: async (_token: string) => ({ id: '7' }),
      findFirst: async () => {
        queried = true
        return { id: 7, username: 'tester', permission: 1 }
      },
    })

    await deriveAuth(context)

    expect(queried).toBe(true)
    expect(context.uid).toBe(7)
    expect(context.username).toBe('tester')
    expect(context.admin).toBe(true)
  })

  it('uses token cookie when Authorization header is missing', async () => {
    let queried = false
    const verifiedTokens: string[] = []
    const context = createContext({
      cookieToken: 'cookie-token',
      verify: async (token: string) => {
        verifiedTokens.push(token)
        if (token === 'cookie-token') {
          return { id: '7' }
        }
        return null
      },
      findFirst: async () => {
        queried = true
        return { id: 7, username: 'tester', permission: 1 }
      },
    })

    await deriveAuth(context)

    expect(verifiedTokens).toEqual(['cookie-token'])
    expect(queried).toBe(true)
    expect(context.uid).toBe(7)
  })

  it('does not fall back to token cookie when Authorization token is invalid', async () => {
    const verifiedTokens: string[] = []
    const context = createContext({
      authHeaderToken: 'stale-token',
      cookieToken: 'cookie-token',
      verify: async (token: string) => {
        verifiedTokens.push(token)
        return null
      },
      findFirst: async () => ({ id: 7, username: 'tester', permission: 1 }),
    })

    await deriveAuth(context)

    expect(verifiedTokens).toEqual(['stale-token'])
    expect(context.uid).toBeUndefined()
    expect(context.username).toBeUndefined()
  })
})
