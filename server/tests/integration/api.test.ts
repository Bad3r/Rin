import type { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { CreateFeedRequest } from '@rin/api'
import { createBaseApp } from '../../src/core/base'
import type { Router } from '../../src/core/router'
import type { DB } from '../../src/server'
import { CommentService } from '../../src/services/comments'
import { FeedService } from '../../src/services/feed'
import { TagService } from '../../src/services/tag'
import { cleanupTestDB, createMockDB, createMockEnv } from '../fixtures'
import { createTestClient } from '../test-api-client'

describe('Integration Tests - API Flow', () => {
  let db: DB
  let sqlite: Database
  let env: Env
  let app: Router
  let api: ReturnType<typeof createTestClient>

  beforeEach(async () => {
    const mockDB = createMockDB()
    db = mockDB.db as unknown as DB
    sqlite = mockDB.sqlite
    env = createMockEnv()

    app = createBaseApp(env)
    app.state('db', db)
    app.state('cache', {
      get: async () => undefined,
      set: async () => {},
      deletePrefix: async () => {},
      getOrSet: async (_key: string, fn: () => unknown) => fn(),
      getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
    })
    app.state('serverConfig', {
      get: async () => undefined,
      getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
    })
    app.state('clientConfig', {
      get: async () => undefined,
      getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
    })
    // Add JWT for authentication
    app.state('jwt', {
      sign: async (payload: Record<string, unknown>) => `mock_token_${String(payload.id ?? '')}`,
      verify: async (token: string) => {
        const match = token.match(/mock_token_(\d+)/)
        return match ? { id: parseInt(match[1], 10) } : null
      },
    })

    // Register services
    FeedService(app)
    TagService(app)
    CommentService(app)

    // Create test API client
    api = createTestClient(app, env)

    // Seed test data locally for integration tests
    await seedTestData()
  })

  afterEach(() => {
    cleanupTestDB(sqlite)
  })

  async function seedTestData() {
    sqlite.exec(`
            INSERT INTO users (id, username, avatar, permission, openid) VALUES 
                (1, 'author', 'author.png', 1, 'gh_author'),
                (2, 'commenter', 'commenter.png', 0, 'gh_commenter')
        `)

    sqlite.exec(`
            INSERT INTO feeds (id, title, content, summary, uid, draft, listed) VALUES 
                (1, 'First Post', 'Content of first post', 'Summary 1', 1, 0, 1)
        `)

    sqlite.exec(`
            INSERT INTO hashtags (id, name) VALUES 
                (1, 'integration')
        `)

    sqlite.exec(`
            INSERT INTO feed_hashtags (feed_id, hashtag_id) VALUES (1, 1)
        `)
  }

  function requireInsertedId(result: { data?: { insertedId?: number } }): number {
    const insertedId = result.data?.insertedId
    expect(insertedId).toBeDefined()
    return insertedId as number
  }

  describe('Full blog post workflow', () => {
    it('should create a post with tags and comments', async () => {
      // 1. Create a new feed using the type-safe API client
      // Use mock_token_1 (user 1 is admin)
      const createResult = await api.feed.create(
        {
          title: 'Integration Test Post',
          content: 'This is an integration test post with #markdown',
          listed: true,
          draft: false,
          tags: [],
        },
        { token: 'mock_token_1' }
      )

      expect(createResult.error).toBeUndefined()
      expect(createResult.data).toBeDefined()
      expect(createResult.data?.insertedId).toBeDefined()

      const feedId = requireInsertedId(createResult)

      // 2. Get the created feed
      const getResult = await api.feed.get(feedId)
      expect(getResult.error).toBeUndefined()
      expect(getResult.data?.title).toBe('Integration Test Post')

      // 3. Add a comment using the type-safe API client
      // Use mock_token_2 (user 2 is regular user)
      const commentResult = await api.comment.create(
        feedId,
        {
          content: 'Great post!',
        },
        { token: 'mock_token_2' }
      )

      expect(commentResult.error).toBeUndefined()

      // 4. Get comments
      const commentsResult = await api.comment.list(feedId)

      expect(commentsResult.error).toBeUndefined()
      expect(commentsResult.data).toBeArray()
      expect(commentsResult.data?.length).toBe(1)
      expect(commentsResult.data?.[0].content).toBe('Great post!')
    })
  })

  describe('Feed and tag relationship', () => {
    it('should show feed in tag listing', async () => {
      // Get tag with feeds using the type-safe API client
      const result = await api.tag.get('integration')

      expect(result.error).toBeUndefined()
      expect(result.data?.name).toBe('integration')
      expect(result.data?.feeds).toBeArray()
      expect(result.data?.feeds.length).toBe(1)
      expect(result.data?.feeds[0].title).toBe('First Post')
    })
  })

  describe('Pagination flow', () => {
    it('should paginate through feeds', async () => {
      // Add more feeds
      for (let i = 2; i <= 5; i++) {
        sqlite.exec(`
                    INSERT INTO feeds (id, title, content, uid, draft, listed) 
                    VALUES (${i}, 'Feed ${i}', 'Content ${i}', 1, 0, 1)
                `)
      }

      // Get first page using the type-safe API client
      const page1 = await api.feed.list({ page: 1, limit: 2 })

      expect(page1.error).toBeUndefined()
      expect(page1.data?.data.length).toBe(2)
      expect(page1.data?.hasNext).toBe(true)

      // Get second page
      const page2 = await api.feed.list({ page: 2, limit: 2 })

      expect(page2.error).toBeUndefined()
      expect(page2.data?.data.length).toBe(2)

      // Pages should have different content
      expect(page1.data?.data[0].id).not.toBe(page2.data?.data[0].id)
    })
  })

  describe('Authentication and authorization', () => {
    it('should protect admin-only endpoints', async () => {
      // Try to create feed without auth using the type-safe API client
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

    it('should allow public read access', async () => {
      const result = await api.feed.get(1)
      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
    })
  })

  describe('Error handling', () => {
    it('should handle 404 gracefully', async () => {
      const result = await api.feed.get(999)
      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(404)
    })

    it('should handle validation errors', async () => {
      // Try to create feed without required fields
      const result = await api.feed.create(
        {} as unknown as CreateFeedRequest, // Missing required fields intentionally
        { isAdmin: true }
      )

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(400)
    })
  })
})
