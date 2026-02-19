import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAuthCookieToken, getAuthToken, headersWithAuth, removeAuthToken, setAuthToken } from '../auth'

function clearAuthCookie(): void {
  document.cookie = 'auth_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax'
}

describe('auth utils', () => {
  beforeEach(() => {
    localStorage.clear()
    clearAuthCookie()
  })

  afterEach(() => {
    localStorage.clear()
    clearAuthCookie()
  })

  it('reads auth token from localStorage', () => {
    setAuthToken('local-token')

    expect(getAuthToken()).toBe('local-token')
    expect(headersWithAuth()).toEqual({ Authorization: 'Bearer local-token' })
  })

  it('reads auth token from auth_token cookie', () => {
    document.cookie = 'auth_token=cookie-token; Path=/; SameSite=Lax'

    expect(getAuthCookieToken()).toBe('cookie-token')
  })

  it('clears local and auth cookie tokens', () => {
    setAuthToken('local-token')
    document.cookie = 'auth_token=cookie-token; Path=/; SameSite=Lax'

    removeAuthToken()

    expect(getAuthToken()).toBeNull()
    expect(getAuthCookieToken()).toBeNull()
  })
})
