import type { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { CreateFeedRequest } from '@rin/api'
import { cleanupTestDB, createMockDB, createMockEnv } from '../../../tests/fixtures'
import { createTestClient } from '../../../tests/test-api-client'
import { createBaseApp } from '../../core/base'
import { CommentService } from '../comments'
import { FeedService } from '../feed'
import { TagService } from '../tag'

describe('FeedService', () => {
  let db: ReturnType<typeof createMockDB>['db']
  let sqlite: Database
  let env: Env
  let app: ReturnType<typeof createBaseApp>
  let api: ReturnType<typeof createTestClient>

  beforeEach(async () => {
    const mockDB = createMockDB()
    db = mockDB.db
    sqlite = mockDB.sqlite
    env = createMockEnv()

    // Setup app with mock db
    app = createBaseApp(env)
    app.state('db', db)
    app.state('jwt', {
      sign: async (payload: { id: number }) => `mock_token_${payload.id}`,
      verify: async (token: string) => (token.startsWith('mock_token_') ? { id: 1 } : null),
    })
    app.state('cache', {
      get: async () => undefined,
      set: async () => {},
      delete: async () => {},
      deletePrefix: async () => {},
      getOrSet: async (_key: string, fn: () => unknown) => fn(),
      getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
    })
    app.state('clientConfig', {
      getOrDefault: async (_key: string, defaultValue: unknown) => defaultValue,
    })

    // Register all services
    FeedService(app)
    TagService(app)
    CommentService(app)

    // Create test API client
    api = createTestClient(app, env)

    // Create test user via User API (or mock context)
    await createTestUser()
  })

  afterEach(() => {
    cleanupTestDB(sqlite)
  })

  async function createTestUser() {
    // Create a user by directly inserting to DB (this is setup, not the test)
    sqlite.exec(`
            INSERT INTO users (id, username, openid, avatar, permission) 
            VALUES (1, 'testuser', 'gh_test', 'avatar.png', 1)
        `)
  }

  function requireInsertedId(insertedId: number | undefined): number {
    if (insertedId === undefined) {
      throw new Error('Expected insertedId to be defined')
    }
    return insertedId
  }

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
      expect(listResult.data?.data).toBeArray()
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
      const feedId = requireInsertedId(createResult.data?.insertedId)

      const getResult = await api.feed.get(feedId)

      expect(getResult.error).toBeUndefined()
      expect(getResult.data?.title).toBe('Test Feed')
    })

    it('should return 404 for non-existent feed', async () => {
      const result = await api.feed.get(9999)

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(404)
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
        } as unknown as CreateFeedRequest,
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
        } as unknown as CreateFeedRequest,
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
      const feedId = requireInsertedId(createResult.data?.insertedId)

      const updateResult = await api.feed.update(
        feedId,
        {
          title: 'Updated Title',
          content: 'Updated content',
          listed: true,
        },
        { token: 'mock_token_1' }
      )

      expect(updateResult.error).toBeUndefined()

      // Verify update
      const getResult = await api.feed.get(feedId)
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
      const feedId = requireInsertedId(createResult.data?.insertedId)

      const updateResult = await api.feed.update(feedId, {
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
      const feedId = requireInsertedId(createResult.data?.insertedId)

      const deleteResult = await api.feed.delete(feedId, { token: 'mock_token_1' })

      expect(deleteResult.error).toBeUndefined()

      // Verify deletion
      const getResult = await api.feed.get(feedId)
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
      const feedId = requireInsertedId(createResult.data?.insertedId)

      const deleteResult = await api.feed.delete(feedId)

      expect(deleteResult.error).toBeDefined()
      expect(deleteResult.error?.status).toBe(403)
    })

    it('should return 404 for non-existent feed', async () => {
      const result = await api.feed.delete(9999, { token: 'mock_token_1' })

      expect(result.error).toBeDefined()
      expect(result.error?.status).toBe(404)
    })
  })

  describe('POST /wp - WordPress import', () => {
    it('imports a single-item export where channel.item is an object', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wp="http://wordpress.org/export/1.2/">
  <channel>
    <item>
      <title>Imported Single Item</title>
      <content:encoded><![CDATA[Imported content]]></content:encoded>
      <wp:status>publish</wp:status>
      <wp:post_date>2024-01-01 00:00:00</wp:post_date>
      <wp:post_modified>2024-01-02 00:00:00</wp:post_modified>
    </item>
  </channel>
</rss>`

      const formData = new FormData()
      formData.append('data', new File([xml], 'export.xml', { type: 'text/xml' }))

      const result = await api.post<{
        success: number
        skipped: number
        skippedList: Array<{ title: string; reason: string }>
      }>('/wp', formData, { token: 'mock_token_1' })

      expect(result.error).toBeUndefined()
      expect(result.data?.success).toBe(1)
      expect(result.data?.skipped).toBe(0)

      const row = sqlite
        .query('SELECT title, content, uid, draft FROM feeds WHERE title = ?')
        .get('Imported Single Item') as {
        title: string
        content: string
        uid: number
        draft: number
      } | null
      expect(row).not.toBeNull()
      expect(row?.uid).toBe(1)
      expect(row?.draft).toBe(0)
      expect(typeof row?.content).toBe('string')
      expect((row?.content || '').length).toBeGreaterThan(0)
    })
  })
})
