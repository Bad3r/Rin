import type { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { LoginRequest } from '@rin/api'
import type { Router } from '../../core/router'
import type { DB } from '../../server'
import { cleanupTestDB, createMockDB, createMockEnv } from '../../../tests/fixtures'
import { createTestClient } from '../../../tests/test-api-client'
import { createBaseApp } from '../../core/base'
import { PasswordAuthService } from '../auth'

describe('PasswordAuthService', () => {
  let db: DB
  let sqlite: Database
  let env: Env
  let app: Router
  let api: ReturnType<typeof createTestClient>

  const mockSign = async (payload: Record<string, unknown>) => {
    const id = typeof payload.id === 'number' ? payload.id : Number.parseInt(String(payload.id ?? ''), 10)
    return `mock_token_${Number.isFinite(id) ? id : 0}`
  }

  const messageOf = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') {
      return undefined
    }
    const error = (value as { error?: unknown }).error
    if (!error || typeof error !== 'object') {
      return undefined
    }
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
  }

  beforeEach(async () => {
    const mockDB = createMockDB()
    db = mockDB.db as unknown as DB
    sqlite = mockDB.sqlite
    env = createMockEnv({
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'admin123',
    })

    // Setup app with mock db
    app = createBaseApp(env)
    app.state('db', db)
    app.state('jwt', {
      sign: mockSign,
      verify: async (token: string) => {
        const match = token.match(/mock_token_(\d+)/)
        return match ? { id: parseInt(match[1], 10) } : null
      },
    })
    app.state('anyUser', async () => false)

    // Initialize service
    PasswordAuthService(app)

    // Create test API client
    api = createTestClient(app, env)

    // Seed test data
    await seedTestData(sqlite)
  })

  afterEach(() => {
    cleanupTestDB(sqlite)
  })

  async function seedTestData(sqlite: Database) {
    // Insert a regular user with password
    sqlite.exec(`
            INSERT INTO users (id, username, avatar, permission, openid, password) VALUES 
                (1, 'user1', 'avatar1.png', 0, 'gh_123', NULL),
                (2, 'regular', 'regular.png', 0, 'gh_regular', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3')
        `)
  }

  describe('POST /auth/login - Login with password', () => {
    it('should login with admin credentials', async () => {
      const result = await api.auth.login({
        username: 'admin',
        password: 'admin123',
      })

      expect(result.error).toBeUndefined()
      expect(result.data?.success).toBe(true)
      expect(result.data?.token).toBeDefined()
      expect(result.data?.user.username).toBe('admin')
      expect(result.data?.user.permission).toBe(true)
    })

    it('should create admin user on first login', async () => {
      // Clear existing users
      sqlite.exec('DELETE FROM users')

      const result = await api.auth.login({
        username: 'admin',
        password: 'admin123',
      })

      expect(result.error).toBeUndefined()
      expect(result.data?.success).toBe(true)

      // Verify admin was created using raw SQLite
      const dbResult = sqlite.prepare(`SELECT * FROM users WHERE openid = 'admin'`).all()
      expect(dbResult.length).toBe(1)
      expect((dbResult[0] as { permission?: number } | undefined)?.permission).toBe(1)
    })

    it('should reject invalid admin password', async () => {
      const result = await api.auth.login({
        username: 'admin',
        password: 'wrongpassword',
      })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(403)
      expect(messageOf(result.error?.value)).toBe('Invalid credentials')
    })

    it('should login with regular user credentials', async () => {
      // Regular user password is SHA-256 of '123'
      const result = await api.auth.login({
        username: 'regular',
        password: '123',
      })

      expect(result.error).toBeUndefined()
      expect(result.data?.success).toBe(true)
      expect(result.data?.user.username).toBe('regular')
      expect(result.data?.user.permission).toBe(false)
    })

    it('should reject non-existent user', async () => {
      const result = await api.auth.login({
        username: 'nonexistent',
        password: 'password',
      })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(403)
      expect(messageOf(result.error?.value)).toBe('Invalid credentials')
    })

    it('should require username and password', async () => {
      const result = await api.auth.login({} as unknown as LoginRequest)

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(400)
      expect(messageOf(result.error?.value)).toBe('Username and password are required')
    })

    it('should return 400 if admin credentials not configured', async () => {
      const envNoCreds = createMockEnv({
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: '',
      })

      const appNoCreds = createBaseApp(envNoCreds)
      appNoCreds.state('db', db)
      appNoCreds.state('jwt', {
        sign: mockSign,
        verify: async (token: string) => {
          const match = token.match(/mock_token_(\d+)/)
          return match ? { id: parseInt(match[1], 10) } : null
        },
      })
      PasswordAuthService(appNoCreds)

      const apiNoCreds = createTestClient(appNoCreds, envNoCreds)

      const result = await apiNoCreds.auth.login({
        username: 'admin',
        password: 'admin123',
      })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(400)
      expect(messageOf(result.error?.value)).toBe('Admin credentials not configured')
    })

    it('should reject user without password', async () => {
      const result = await api.auth.login({
        username: 'user1',
        password: 'anypassword',
      })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(403)
      expect(messageOf(result.error?.value)).toBe('Invalid credentials')
    })
  })

  describe('GET /auth/status - Check auth availability', () => {
    it('should return github and password status', async () => {
      const result = await api.auth.status()

      expect(result.error).toBeUndefined()
      expect(result.data?.github).toBe(true) // Has GitHub credentials in env
      expect(result.data?.password).toBe(true) // Has admin credentials
    })

    it('should return false when credentials not configured', async () => {
      const envNoCreds = createMockEnv({
        RIN_GITHUB_CLIENT_ID: '',
        RIN_GITHUB_CLIENT_SECRET: '',
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: '',
      })

      const appNoCreds = createBaseApp(envNoCreds)
      appNoCreds.state('db', db)
      PasswordAuthService(appNoCreds)

      const apiNoCreds = createTestClient(appNoCreds, envNoCreds)

      const result = await apiNoCreds.auth.status()

      expect(result.error).toBeUndefined()
      expect(result.data?.github).toBe(false)
      expect(result.data?.password).toBe(false)
    })
  })
})
