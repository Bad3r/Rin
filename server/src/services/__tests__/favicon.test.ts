import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FaviconService, FAVICON_ALLOWED_TYPES, getFaviconKey } from '../favicon'
import { createBaseApp } from '../../core/base'
import { createMockDB, createMockEnv, cleanupTestDB, execSql } from '../../../tests/fixtures'

describe('FaviconService', () => {
  let db: any
  let sqlite: D1Database
  let env: Env
  let app: any

  beforeEach(async () => {
    const mockDB = createMockDB()
    db = mockDB.db
    sqlite = mockDB.sqlite
    env = createMockEnv()

    // Setup app with mock db
    app = createBaseApp(env)
    app.state('db', db)
    app.state('jwt', {
      sign: async (payload: any) => `mock_token_${payload.id}`,
      verify: async (token: string) => (token.startsWith('mock_token_') ? { id: 1 } : null),
    })

    // Register service
    FaviconService(app)

    // Create test user
    await createTestUser()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await cleanupTestDB(sqlite)
  })

  async function createTestUser() {
    await execSql(
      sqlite,
      `
            INSERT INTO users (id, username, openid, avatar, permission) 
            VALUES (1, 'admin', 'gh_admin', 'admin.png', 1)
        `
    )
  }

  describe('GET /favicon - Get favicon', () => {
    it('should return 500 when outbound fetch is blocked by test guard', async () => {
      const request = new Request('http://localhost/favicon')
      const response = await app.handle(request, env)

      expect(response.status).toBe(500)
      await expect(response.text()).resolves.toContain('Error fetching favicon:')
    })

    it('should set correct content type header for successful fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
        })
      )

      const request = new Request('http://localhost/favicon')
      const response = await app.handle(request, env)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('should set cache control header for successful fetch', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
        })
      )

      const request = new Request('http://localhost/favicon')
      const response = await app.handle(request, env)

      expect(response.status).toBe(200)
      const cacheControl = response.headers.get('Cache-Control')
      expect(cacheControl).toContain('max-age=31536000')
    })
  })

  describe('GET /favicon/original - Get original favicon', () => {
    it('should return original favicon from first successful type probe', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response(new Uint8Array([9]), { status: 200 }))

      const request = new Request('http://localhost/favicon/original')
      const response = await app.handle(request, env)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('should return 404 when original favicon not found', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }))

      const request = new Request('http://localhost/favicon/original')
      const response = await app.handle(request, env)

      expect(response.status).toBe(404)
      await expect(response.text().then((text: string) => JSON.parse(text))).resolves.toBe('Original favicon not found')
    })
  })

  describe('POST /favicon - Upload favicon', () => {
    it('should require admin permission', async () => {
      const file = new File(['test'], 'favicon.png', { type: 'image/png' })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/favicon', {
        method: 'POST',
        body: formData,
      })

      const response = await app.handle(request, env)
      expect(response.status).toBe(403)
      await expect(response.text().then((text: string) => JSON.parse(text))).resolves.toBe('Permission denied')
    })

    it('should reject files over 10MB', async () => {
      // Create a mock file that appears to be larger than 10MB
      const largeContent = new Uint8Array(10 * 1024 * 1024 + 1)
      const file = new File([largeContent], 'favicon.png', { type: 'image/png' })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/favicon', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock_token_1',
        },
        body: formData,
      })

      const response = await app.handle(request, env)
      expect(response.status).toBe(400)
    })

    it('should reject disallowed file types', async () => {
      const file = new File(['test'], 'favicon.txt', { type: 'text/plain' })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/favicon', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock_token_1',
        },
        body: formData,
      })

      const response = await app.handle(request, env)
      expect(response.status).toBe(400)
    })

    it('should accept allowed image types', async () => {
      // Validation passes, then upstream upload/transform is blocked by no-network guard.
      const file = new File(['test'], 'favicon.png', { type: 'image/png' })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/favicon', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock_token_1',
        },
        body: formData,
      })

      const response = await app.handle(request, env)
      expect(response.status).toBe(500)
      await expect(response.text()).resolves.toContain('Error processing favicon:')
    })
  })

  describe('FAVICON_ALLOWED_TYPES', () => {
    it('should contain allowed image types', () => {
      expect(FAVICON_ALLOWED_TYPES['image/jpeg']).toBe('.jpg')
      expect(FAVICON_ALLOWED_TYPES['image/png']).toBe('.png')
      expect(FAVICON_ALLOWED_TYPES['image/gif']).toBe('.gif')
      expect(FAVICON_ALLOWED_TYPES['image/webp']).toBe('.webp')
    })

    it('should have correct number of allowed types', () => {
      expect(Object.keys(FAVICON_ALLOWED_TYPES).length).toBe(4)
    })
  })

  describe('getFaviconKey', () => {
    it('should return favicon path with S3 folder', () => {
      const env = createMockEnv()
      const key = getFaviconKey(env)
      expect(key).toBe('images/favicon.webp')
    })

    it('should handle empty S3_FOLDER', () => {
      const env = createMockEnv({
        S3_FOLDER: '' as any,
      })
      const key = getFaviconKey(env)
      expect(key).toBe('favicon.webp')
    })
  })
})
