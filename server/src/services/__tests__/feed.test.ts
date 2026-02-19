import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTestDB, createMockDB, createMockEnv, createTestUser as seedAdminUser } from '../../../tests/fixtures'
import { createTestClient } from '../../../tests/test-api-client'
import { createBaseApp } from '../../core/base'
import { CommentService } from '../comments'
import { FeedService } from '../feed'
import { TagService } from '../tag'

describe('FeedService', () => {
  let db: any
  let sqlite: D1Database
  let env: Env
  let app: any
  let api: ReturnType<typeof createTestClient>

  beforeEach(async () => {
    const mockDB = createMockDB()
    db = mockDB.db
    sqlite = mockDB.sqlite
    env = createMockEnv()
    const cacheStore = new Map<string, unknown>()

    // Setup app with mock db
    app = createBaseApp(env)
    app.state('db', db)
    app.state('jwt', {
      sign: async (payload: any) => `mock_token_${payload.id}`,
      verify: async (token: string) => (token.startsWith('mock_token_') ? { id: 1 } : null),
    })
    app.state('cache', {
      get: async (key: string) => cacheStore.get(key),
      set: async (key: string, value: unknown) => {
        cacheStore.set(key, value)
      },
      delete: async (key: string) => {
        cacheStore.delete(key)
      },
      deletePrefix: async (prefix: string) => {
        for (const key of cacheStore.keys()) {
          if (key.startsWith(prefix)) {
            cacheStore.delete(key)
          }
        }
      },
      getOrSet: async (key: string, fn: Function) => {
        if (cacheStore.has(key)) {
          return cacheStore.get(key)
        }
        const value = await fn()
        cacheStore.set(key, value)
        return value
      },
      getOrDefault: async (key: string, defaultValue: unknown) => {
        if (cacheStore.has(key)) {
          return cacheStore.get(key)
        }
        return defaultValue
      },
    })
    app.state('clientConfig', {
      getOrDefault: async (_key: string, defaultValue: any) => defaultValue,
    })

    // Register all services
    FeedService(app)
    TagService(app)
    CommentService(app)

    // Create test API client
    api = createTestClient(app, env)

    // Create test user via User API (or mock context)
    await seedAdminUser(sqlite)
  })

  afterEach(async () => {
    await cleanupTestDB(sqlite)
  })

  describe('GET /feed - List feeds', () => {
    it('should list published feeds', async () => {
      // Create feeds via API using type-safe client
      const result1 = await api.feed.create(
        {
          title: 'Test Feed 1',
          content: 'Content 1',
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )
      expect(result1.error).toBeUndefined()

      const result2 = await api.feed.create(
        {
          title: 'Test Feed 2',
          content: 'Content 2',
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )
      expect(result2.error).toBeUndefined()

      const listResult = await api.feed.list({ page: 1, limit: 10 })

      expect(listResult.error).toBeUndefined()
      expect(listResult.data?.size).toBe(2)
      expect(Array.isArray(listResult.data?.data)).toBe(true)
    })

    it('should return empty list when no feeds exist', async () => {
      const result = await api.feed.list()

      expect(result.error).toBeUndefined()
      expect(result.data?.size).toBe(0)
      expect(result.data?.data).toEqual([])
    })

    it('should filter drafts for non-admin users', async () => {
      // Create a draft feed via API
      const createResult = await api.feed.create(
        {
          title: 'Draft Feed',
          content: 'Draft Content',
          listed: true,
          draft: true,
          tags: [],
        },
        { token: 'mock_token_1' }
      )
      expect(createResult.error).toBeUndefined()

      const result = await api.feed.list({ type: 'draft' })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(403)
    })

    it('should allow admin to view drafts', async () => {
      // Create a draft feed via API
      const createResult = await api.feed.create(
        {
          title: 'Draft Feed',
          content: 'Draft Content',
          listed: true,
          draft: true,
          tags: [],
        },
        { token: 'mock_token_1' }
      )
      expect(createResult.error).toBeUndefined()

      const result = await api.feed.list({ type: 'draft' }, { token: 'mock_token_1' })

      expect(result.error).toBeUndefined()
      expect(result.data?.size).toBe(1)
    })
  })

  describe('GET /feed/:id - Get single feed', () => {
    it('should return feed by id', async () => {
      // Create a feed first using type-safe API
      const createResult = await api.feed.create(
        {
          title: 'Test Feed',
          content: 'Test Content',
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )

      expect(createResult.error).toBeUndefined()
      const feedId = createResult.data?.insertedId
      expect(feedId).toBeDefined()

      const getResult = await api.feed.get(feedId!)

      expect(getResult.error).toBeUndefined()
      expect(getResult.data?.title).toBe('Test Feed')
    })

    it('should return 404 for non-existent feed', async () => {
      const result = await api.feed.get(9999)

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(404)
    })
  })

  describe('GET /search/:keyword - Search feeds', () => {
    it('should exclude draft and unlisted feeds for non-admin users', async () => {
      const keyword = 'search-public-filter'
      await api.feed.create(
        {
          title: `${keyword}-public`,
          content: `content ${keyword} public`,
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )
      await api.feed.create(
        {
          title: `${keyword}-draft`,
          content: `content ${keyword} draft`,
          listed: true,
          draft: true,
          tags: [],
        },
        { token: 'mock_token_1' }
      )
      await api.feed.create(
        {
          title: `${keyword}-unlisted`,
          content: `content ${keyword} unlisted`,
          listed: false,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )

      const result = await api.search.search(keyword)

      expect(result.error).toBeUndefined()
      expect(result.data?.size).toBe(1)
      expect(result.data?.data).toHaveLength(1)
      expect(result.data?.data[0]?.title).toBe(`${keyword}-public`)
    })

    it('should include draft and unlisted feeds for admin users', async () => {
      const keyword = 'search-admin-all'
      await api.feed.create(
        {
          title: `${keyword}-public`,
          content: `content ${keyword} public`,
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )
      await api.feed.create(
        {
          title: `${keyword}-draft`,
          content: `content ${keyword} draft`,
          listed: true,
          draft: true,
          tags: [],
        },
        { token: 'mock_token_1' }
      )
      await api.feed.create(
        {
          title: `${keyword}-unlisted`,
          content: `content ${keyword} unlisted`,
          listed: false,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )

      const result = await api.search.search(keyword, undefined, { token: 'mock_token_1' })

      expect(result.error).toBeUndefined()
      expect(result.data?.size).toBe(3)
      expect(result.data?.data).toHaveLength(3)
    })

    it('should not leak admin search cache entries to non-admin users', async () => {
      const keyword = 'search-cache-admin-first'
      await api.feed.create(
        {
          title: `${keyword}-public`,
          content: `content ${keyword} public`,
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )
      await api.feed.create(
        {
          title: `${keyword}-draft`,
          content: `content ${keyword} draft`,
          listed: true,
          draft: true,
          tags: [],
        },
        { token: 'mock_token_1' }
      )

      const adminResult = await api.search.search(keyword, undefined, { token: 'mock_token_1' })
      expect(adminResult.error).toBeUndefined()
      expect(adminResult.data?.size).toBe(2)

      const publicResult = await api.search.search(keyword)

      expect(publicResult.error).toBeUndefined()
      expect(publicResult.data?.size).toBe(1)
      expect(publicResult.data?.data).toHaveLength(1)
      expect(publicResult.data?.data[0]?.title).toBe(`${keyword}-public`)
    })

    it('should keep admin results complete after a public search caches first', async () => {
      const keyword = 'search-cache-public-first'
      await api.feed.create(
        {
          title: `${keyword}-public`,
          content: `content ${keyword} public`,
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )
      await api.feed.create(
        {
          title: `${keyword}-draft`,
          content: `content ${keyword} draft`,
          listed: true,
          draft: true,
          tags: [],
        },
        { token: 'mock_token_1' }
      )

      const publicResult = await api.search.search(keyword)
      expect(publicResult.error).toBeUndefined()
      expect(publicResult.data?.size).toBe(1)

      const adminResult = await api.search.search(keyword, undefined, { token: 'mock_token_1' })

      expect(adminResult.error).toBeUndefined()
      expect(adminResult.data?.size).toBe(2)
      expect(adminResult.data?.data).toHaveLength(2)
    })

    it('should honor page and limit query parameters', async () => {
      const keyword = 'search-pagination'
      await api.feed.create(
        {
          title: `${keyword}-a`,
          content: `content ${keyword} a`,
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )
      await api.feed.create(
        {
          title: `${keyword}-b`,
          content: `content ${keyword} b`,
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )

      const page1 = await api.search.search(keyword, { page: 1, limit: 1 })
      expect(page1.error).toBeUndefined()
      expect(page1.data?.size).toBe(2)
      expect(page1.data?.data).toHaveLength(1)
      expect(page1.data?.hasNext).toBe(true)

      const page2 = await api.search.search(keyword, { page: 2, limit: 1 })
      expect(page2.error).toBeUndefined()
      expect(page2.data?.size).toBe(2)
      expect(page2.data?.data).toHaveLength(1)
      expect(page2.data?.hasNext).toBe(false)
    })
  })

  describe('POST /feed - Create feed', () => {
    it('should create feed with admin permission', async () => {
      const result = await api.feed.create(
        {
          title: 'New Test Feed',
          content: 'This is a new test feed content',
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeUndefined()
      expect(result.data?.insertedId).toBeDefined()
    })

    it('should require admin permission', async () => {
      const result = await api.feed.create({
        title: 'Test',
        content: 'Test',
        tags: [],
        draft: false,
        listed: true,
      })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(403)
    })

    it('should require title', async () => {
      const result = await api.feed.create(
        {
          content: 'Content without title',
          tags: [],
          draft: false,
          listed: true,
        } as any,
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(400)
    })

    it('should require content', async () => {
      const result = await api.feed.create(
        {
          title: 'Test',
          content: '',
          tags: [],
        } as any,
        { token: 'mock_token_1' }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(400)
    })
  })

  describe('POST /feed/:id - Update feed', () => {
    it('should update feed with admin permission', async () => {
      // Create feed first using type-safe API
      const createResult = await api.feed.create(
        {
          title: 'Original Title',
          content: 'Original Content',
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )

      expect(createResult.error).toBeUndefined()
      const feedId = createResult.data?.insertedId
      expect(feedId).toBeDefined()

      const updateResult = await api.feed.update(
        feedId!,
        {
          title: 'Updated Title',
          content: 'Updated content',
          listed: true,
        },
        { token: 'mock_token_1' }
      )

      expect(updateResult.error).toBeUndefined()

      // Verify update
      const getResult = await api.feed.get(feedId!)
      expect(getResult.data?.title).toBe('Updated Title')
    })

    it('should require admin permission to update', async () => {
      // Create feed first using type-safe API
      const createResult = await api.feed.create(
        {
          title: 'Original',
          content: 'Content',
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )

      expect(createResult.error).toBeUndefined()
      const feedId = createResult.data?.insertedId
      expect(feedId).toBeDefined()

      const updateResult = await api.feed.update(feedId!, {
        title: 'New Title',
        listed: true,
      })

      expect(updateResult.error).toBeDefined()
      expect(updateResult.error?.status).toBe(403)
    })
  })

  describe('DELETE /feed/:id - Delete feed', () => {
    it('should delete feed with admin permission', async () => {
      // Create feed first using type-safe API
      const createResult = await api.feed.create(
        {
          title: 'To Delete',
          content: 'Content',
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )

      expect(createResult.error).toBeUndefined()
      const feedId = createResult.data?.insertedId
      expect(feedId).toBeDefined()

      const deleteResult = await api.feed.delete(feedId!, { token: 'mock_token_1' })

      expect(deleteResult.error).toBeUndefined()

      // Verify deletion
      const getResult = await api.feed.get(feedId!)
      expect(getResult.error?.status).toBe(404)
    })

    it('should require admin permission to delete', async () => {
      // Create feed first using type-safe API
      const createResult = await api.feed.create(
        {
          title: 'Test',
          content: 'Content',
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )

      expect(createResult.error).toBeUndefined()
      const feedId = createResult.data?.insertedId
      expect(feedId).toBeDefined()

      const deleteResult = await api.feed.delete(feedId!)

      expect(deleteResult.error).toBeDefined()
      expect(deleteResult.error?.status).toBe(403)
    })

    it('should return 404 for non-existent feed', async () => {
      const result = await api.feed.delete(9999, { token: 'mock_token_1' })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(404)
    })
  })
})
