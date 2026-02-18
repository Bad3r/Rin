import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTestDB, createMockDB, createMockEnv, execSql, queryAll, seedTestData } from '../../../tests/fixtures'
import { createBaseApp } from '../../core/base'
import { bindTagToPost, TagService } from '../tag'

describe('TagService', () => {
  let db: any
  let sqlite: D1Database
  let env: Env
  let app: any

  beforeEach(async () => {
    const mockDB = createMockDB()
    db = mockDB.db
    sqlite = mockDB.sqlite
    env = createMockEnv()

    // Setup app with mock db and JWT
    app = createBaseApp(env)
    app.state('db', db)
    app.state('jwt', {
      sign: async (payload: any) => `mock_token_${payload.id}`,
      verify: async (token: string) => {
        const match = token.match(/mock_token_(\d+)/)
        return match ? { id: parseInt(match[1], 10) } : null
      },
    })

    // Initialize service
    TagService(app)

    // Seed test data using sqlite directly
    await seedTestData(sqlite)
  })

  afterEach(async () => {
    await cleanupTestDB(sqlite)
  })

  describe('GET /tag - List all tags', () => {
    it('should return all tags with feed counts', async () => {
      const request = new Request('http://localhost/tag')
      const response = await app.handle(request, env)

      expect(response.status).toBe(200)
      const data = (await response.json()) as Array<{ name: string; count: number; feeds?: unknown }>
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)

      const testTag = data.find(t => t.name === 'test')
      expect(testTag).toBeDefined()
      if (!testTag) {
        throw new Error('missing test tag')
      }
      expect(testTag.count).toBe(2) // test has 2 feeds
      expect(testTag.feeds).toBeUndefined()

      const integrationTag = data.find(t => t.name === 'integration')
      expect(integrationTag).toBeDefined()
      if (!integrationTag) {
        throw new Error('missing integration tag')
      }
      expect(integrationTag.count).toBe(1) // integration has 1 feed
      expect(integrationTag.feeds).toBeUndefined()
    })

    it('should return empty array when no tags exist', async () => {
      // Clear all tags
      await execSql(sqlite, 'DELETE FROM feed_hashtags')
      await execSql(sqlite, 'DELETE FROM hashtags')

      const request = new Request('http://localhost/tag')
      const response = await app.handle(request, env)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual([])
    })
  })

  describe('GET /tag/:name - Get tag details', () => {
    it('should return tag with feeds', async () => {
      const request = new Request('http://localhost/tag/test')
      const response = await app.handle(request, env)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.name).toBe('test')
      expect(Array.isArray(data.feeds)).toBe(true)
      expect(data.feeds.length).toBe(2)
    })

    it('should decode URL-encoded tag names', async () => {
      // Insert tag with space in name
      await execSql(sqlite, `INSERT INTO hashtags (id, name) VALUES (3, 'web dev')`)
      await execSql(sqlite, `INSERT INTO feed_hashtags (feed_id, hashtag_id) VALUES (1, 3)`)

      const request = new Request('http://localhost/tag/web%20dev')
      const response = await app.handle(request, env)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.name).toBe('web dev')
    })

    it('should return 404 for non-existent tag', async () => {
      const request = new Request('http://localhost/tag/nonexistent')
      const response = await app.handle(request, env)

      expect(response.status).toBe(404)
      const errorText = await response.text()
      expect(errorText).toContain('Not found')
    })

    it('should exclude draft feeds for non-admin users', async () => {
      // Create draft feed and link to test tag
      await execSql(
        sqlite,
        `INSERT INTO feeds (id, title, content, uid, draft, listed) VALUES (3, 'Draft', 'Content', 1, 1, 1)`
      )
      await execSql(sqlite, `INSERT INTO feed_hashtags (feed_id, hashtag_id) VALUES (3, 1)`)

      const request = new Request('http://localhost/tag/test')
      const response = await app.handle(request, env)

      expect(response.status).toBe(200)
      const data = await response.json()
      // Should only show published feeds, not draft
      expect(data.feeds.every((f: any) => f.draft !== 1)).toBe(true)

      // Cleanup
      await execSql(sqlite, `DELETE FROM feed_hashtags WHERE feed_id = 3`)
      await execSql(sqlite, `DELETE FROM feeds WHERE id = 3`)
    })

    it('should include draft feeds for admin users', async () => {
      // Create draft feed and link to test tag
      await execSql(
        sqlite,
        `INSERT INTO feeds (id, title, content, uid, draft, listed) VALUES (3, 'Draft', 'Content', 1, 1, 1)`
      )
      await execSql(sqlite, `INSERT INTO feed_hashtags (feed_id, hashtag_id) VALUES (3, 1)`)

      // User 2 is admin (permission=1), need to use JWT token
      const request = new Request('http://localhost/tag/test', {
        headers: { Authorization: 'Bearer mock_token_2' },
      })
      const response = await app.handle(request, env)

      expect(response.status).toBe(200)
      const data = await response.json()
      // Should show all feeds including draft (2 published + 1 draft = 3)
      expect(data.feeds.length).toBe(3)

      // Cleanup
      await execSql(sqlite, `DELETE FROM feed_hashtags WHERE feed_id = 3`)
      await execSql(sqlite, `DELETE FROM feeds WHERE id = 3`)
    })

    it('should include hashtags in feed data', async () => {
      const request = new Request('http://localhost/tag/test')
      const response = await app.handle(request, env)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.feeds.length).toBeGreaterThan(0)
      expect(Array.isArray(data.feeds[0].hashtags)).toBe(true)
    })
  })

  describe('bindTagToPost function', () => {
    it('should bind tags to a feed', async () => {
      await bindTagToPost(db, 1, ['newtag1', 'newtag2'])

      // Verify tags were created and linked
      const result = await queryAll(
        sqlite,
        `
          SELECT h.name FROM hashtags h
          JOIN feed_hashtags fh ON h.id = fh.hashtag_id
          WHERE fh.feed_id = 1
        `
      )

      expect(result.length).toBeGreaterThan(0)
    })

    it('should create new tags if they do not exist', async () => {
      await bindTagToPost(db, 1, ['brandnewtag'])

      const tagResult = await queryAll(
        sqlite,
        `
          SELECT * FROM hashtags WHERE name = 'brandnewtag'
        `
      )

      expect(tagResult.length).toBe(1)
    })

    it('should remove existing tags before binding new ones', async () => {
      // First bind some tags
      await bindTagToPost(db, 1, ['tag1', 'tag2'])

      // Then bind different tags
      await bindTagToPost(db, 1, ['tag3'])

      // Verify only tag3 is linked
      const result = await queryAll(
        sqlite,
        `
          SELECT h.name FROM hashtags h
          JOIN feed_hashtags fh ON h.id = fh.hashtag_id
          WHERE fh.feed_id = 1
        `
      )

      const tagNames = result.map((r: any) => r.name)
      expect(tagNames).not.toContain('tag1')
      expect(tagNames).not.toContain('tag2')
      expect(tagNames).toContain('tag3')
    })

    it('should reuse existing tags', async () => {
      // First call creates the tag
      await bindTagToPost(db, 1, ['reusable'])

      // Get the tag id
      const tagResult = await queryAll<{ id: number }>(sqlite, `SELECT id FROM hashtags WHERE name = 'reusable'`)
      const tagId = tagResult[0]?.id

      // Second call should reuse the same tag
      await bindTagToPost(db, 2, ['reusable'])

      const feed2Tags = await queryAll<{ hashtag_id: number }>(
        sqlite,
        `
          SELECT hashtag_id FROM feed_hashtags WHERE feed_id = 2
        `
      )

      expect(feed2Tags[0]?.hashtag_id).toBe(tagId)
    })

    it('should handle empty tags array', async () => {
      // First add some tags
      await bindTagToPost(db, 1, ['tag1', 'tag2'])

      // Then bind empty array
      await bindTagToPost(db, 1, [])

      // Verify all tags were removed
      const result = await queryAll<{ count: number }>(
        sqlite,
        `
          SELECT COUNT(*) as count FROM feed_hashtags WHERE feed_id = 1
        `
      )

      expect(result[0]?.count).toBe(0)
    })
  })
})
