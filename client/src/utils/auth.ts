const TOKEN_KEY = 'rin_auth_token'
const AUTH_COOKIE_KEY = 'auth_token'

// In-memory fallback for environments without localStorage (e.g., tests)
let memoryToken: string | null = null
let localStorageAvailable: boolean | null = null

function isLocalStorageAvailable(): boolean {
  if (localStorageAvailable !== null) {
    return localStorageAvailable
  }

  try {
    if (typeof localStorage === 'undefined') {
      localStorageAvailable = false
      return localStorageAvailable
    }
    // Test localStorage
    localStorage.setItem('__test__', 'test')
    localStorage.removeItem('__test__')
    localStorageAvailable = true
    return localStorageAvailable
  } catch {
    localStorageAvailable = false
    return localStorageAvailable
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  for (const cookie of document.cookie.split(';')) {
    const trimmed = cookie.trim()
    if (!trimmed) {
      continue
    }

    const [cookieName, ...valueParts] = trimmed.split('=')
    if (cookieName === name) {
      return decodeURIComponent(valueParts.join('='))
    }
  }

  return null
}

function clearCookie(name: string): void {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`
}

export function getAuthToken(): string | null {
  if (isLocalStorageAvailable()) {
    return localStorage.getItem(TOKEN_KEY)
  }
  return memoryToken
}

export function getAuthCookieToken(): string | null {
  return getCookie(AUTH_COOKIE_KEY)
}

export function setAuthToken(token: string): void {
  if (isLocalStorageAvailable()) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    memoryToken = token
  }
}

export function removeAuthToken(): void {
  if (isLocalStorageAvailable()) {
    localStorage.removeItem(TOKEN_KEY)
  } else {
    memoryToken = null
  }
  clearCookie(AUTH_COOKIE_KEY)
}

export function headersWithAuth(): Record<string, string> {
  const headers: Record<string, string> = {}

  const token = getAuthToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}
