import { describe, expect, it } from 'bun:test'
import type { Context, JWTUtils } from '../types'
import { deriveAuth } from '../setup'

type UserRow = {
  id: number
  username: string
  permission: number
}

function createContext(options: {
  profile: Record<string, unknown> | null
  findFirst: () => Promise<UserRow | undefined>
}): Context {
  const request = new Request('http://localhost/test', {
    headers: { Authorization: 'Bearer test-token' },
  })

  const jwt: JWTUtils = {
    sign: async (_payload: Record<string, unknown>) => 'signed-token',
    verify: async (_token: string) => options.profile,
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
    cookie: {},
    jwt,
    admin: false,
    env: {} as Env,
  }
}

describe('deriveAuth', () => {
  it('ignores non-numeric profile IDs without querying users', async () => {
    let queried = false
    const context = createContext({
      profile: { id: 'not-a-number' },
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
      profile: { id: '7' },
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
})
