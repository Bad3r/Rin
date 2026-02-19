import { eq } from 'drizzle-orm'
import type { Context, CookieValue } from './types'

export async function deriveAuth(context: Context): Promise<void> {
  const { cookie, jwt, store, request } = context

  // Prefer Authorization header, but fall back to cookie token when header token is missing/invalid.
  let headerToken: string | undefined
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    headerToken = authHeader.substring(7)
  }
  const cookieToken = cookie.token?.value

  if ((!headerToken && !cookieToken) || !jwt) {
    return
  }

  let profile = headerToken ? await jwt.verify(headerToken) : null
  if (!profile && cookieToken && cookieToken !== headerToken) {
    profile = await jwt.verify(cookieToken)
  }
  if (!profile) {
    return
  }

  const profileIdRaw = profile.id
  const profileId =
    typeof profileIdRaw === 'number'
      ? profileIdRaw
      : typeof profileIdRaw === 'string'
        ? Number.parseInt(profileIdRaw, 10)
        : NaN

  if (!Number.isFinite(profileId)) {
    return
  }

  const { users } = await import('../db/schema')
  const user = await store.db.query.users.findFirst({
    where: eq(users.id, profileId),
  })

  if (!user) {
    return
  }

  context.uid = user.id
  context.username = user.username
  context.admin = user.permission === 1
}

// Cookie helper
export function createCookieHelpers(context: Context): Record<string, CookieValue> {
  const cookies: Record<string, CookieValue> = {}
  const cookieHeader = context.request.headers.get('cookie') || ''

  // Parse existing cookies
  const parsedCookies = new Map<string, string>()
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=')
    if (name && value) {
      parsedCookies.set(name, decodeURIComponent(value))
    }
  })

  // Create cookie proxy
  return new Proxy(cookies, {
    get(target, prop: string) {
      if (prop in target) {
        return target[prop]
      }

      const value = parsedCookies.get(prop) || ''
      return {
        value,
        set(options: {
          value: string
          expires?: Date
          path?: string
          httpOnly?: boolean
          secure?: boolean
          sameSite?: 'strict' | 'lax' | 'none'
        }) {
          let cookieStr = `${prop}=${encodeURIComponent(options.value)}`
          if (options.expires) {
            cookieStr += `; Expires=${options.expires.toUTCString()}`
          }
          if (options.path) {
            cookieStr += `; Path=${options.path}`
          }
          if (options.httpOnly) {
            cookieStr += `; HttpOnly`
          }
          if (options.secure) {
            cookieStr += `; Secure`
          }
          if (options.sameSite) {
            cookieStr += `; SameSite=${options.sameSite}`
          }
          context.set.headers.append('Set-Cookie', cookieStr)
        },
      }
    },
  })
}
