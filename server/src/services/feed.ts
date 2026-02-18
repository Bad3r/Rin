import {
  asDate,
  type CreateFeedRequest,
  type UpdateFeedRequest,
  feedCreateSchema,
  feedListSchema,
  feedSetTopSchema,
  feedUpdateSchema,
  searchSchema,
  wpImportSchema,
} from '@rin/api'
import { and, asc, count, desc, eq, gt, like, lt, or } from 'drizzle-orm'
import type { Router } from '../core/router'
import type { Context } from '../core/types'
import { feeds, visitStats, visits } from '../db/schema'
import { generateAISummary } from '../utils/ai'
import type { CacheImpl } from '../utils/cache'
import { HyperLogLog } from '../utils/hyperloglog'
import { extractImage } from '../utils/image'
import { bindTagToPost } from './tag'

// Lazy-loaded modules for WordPress import
let XMLParser: typeof import('fast-xml-parser').XMLParser | undefined
let html2md: ((html: string) => string) | undefined

type AdjacentFeed = {
  id: number
  title: string | null
  summary: string
  content: string
  hashtags: Array<{ hashtag: { id: number; name: string } }>
  createdAt: Date
  updatedAt: Date
}

type WordPressItem = {
  title?: string
  category?: string | string[]
  'wp:post_date'?: string
  'wp:post_modified'?: string
  'wp:status'?: string
  'content:encoded'?: string
}

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function normalizedTags(tags: unknown): string[] | undefined {
  if (!Array.isArray(tags)) {
    return undefined
  }
  if (tags.every(tag => typeof tag === 'string')) {
    return tags
  }
  return undefined
}

async function initWPModules() {
  if (!XMLParser) {
    const fxp = await import('fast-xml-parser')
    XMLParser = fxp.XMLParser
  }
  if (!html2md) {
    const h2m = await import('html-to-md')
    html2md = h2m.default
  }
}

export function FeedService(router: Router): void {
  router.group('/feed', group => {
    // GET /feed - List feeds
    group.get(
      '/',
      async (ctx: Context) => {
        const {
          admin,
          set,
          query,
          store: { db, cache },
        } = ctx
        const { page, limit, type } = query
        const pageValue = queryValue(page)
        const limitValue = queryValue(limit)
        const typeValue = queryValue(type)

        if ((typeValue === 'draft' || typeValue === 'unlisted') && !admin) {
          set.status = 403
          return 'Permission denied'
        }

        const page_num = (pageValue ? (parseInt(pageValue, 10) > 0 ? parseInt(pageValue, 10) : 1) : 1) - 1
        const limit_num = limitValue ? (parseInt(limitValue, 10) > 50 ? 50 : parseInt(limitValue, 10)) : 20
        const cacheKey = `feeds_${typeValue}_${page_num}_${limit_num}`
        const cached = await cache.get(cacheKey)

        if (cached) {
          return cached
        }

        const where =
          typeValue === 'draft'
            ? eq(feeds.draft, 1)
            : typeValue === 'unlisted'
              ? and(eq(feeds.draft, 0), eq(feeds.listed, 0))
              : and(eq(feeds.draft, 0), eq(feeds.listed, 1))

        const size = await db.select({ count: count() }).from(feeds).where(where)

        if (size[0].count === 0) {
          return { size: 0, data: [], hasNext: false }
        }

        const feed_list = (
          await db.query.feeds.findMany({
            where: where,
            columns: admin ? undefined : { draft: false, listed: false },
            with: {
              hashtags: {
                columns: {},
                with: {
                  hashtag: { columns: { id: true, name: true } },
                },
              },
              user: { columns: { id: true, username: true, avatar: true } },
            },
            orderBy: [desc(feeds.top), desc(feeds.createdAt), desc(feeds.updatedAt)],
            offset: page_num * limit_num,
            limit: limit_num + 1,
          })
        ).map(({ content, hashtags, summary, ...other }) => {
          const avatar = extractImage(content)
          return {
            summary: summary.length > 0 ? summary : content.length > 100 ? content.slice(0, 100) : content,
            hashtags: hashtags.map(({ hashtag }) => hashtag),
            avatar,
            ...other,
          }
        })

        let hasNext = false
        if (feed_list.length === limit_num + 1) {
          feed_list.pop()
          hasNext = true
        }

        const data = { size: size[0].count, data: feed_list, hasNext }

        if (typeValue === undefined || typeValue === 'normal' || typeValue === '') {
          await cache.set(cacheKey, data)
        }

        return data
      },
      feedListSchema
    )

    // GET /feed/timeline
    group.get('/timeline', async (ctx: Context) => {
      const {
        store: { db },
      } = ctx
      const where = and(eq(feeds.draft, 0), eq(feeds.listed, 1))

      return await db.query.feeds.findMany({
        where: where,
        columns: { id: true, title: true, createdAt: true },
        orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
      })
    })

    // POST /feed - Create feed
    group.post(
      '/',
      async (ctx: Context) => {
        const {
          admin,
          set,
          uid,
          body,
          store: { db, cache, env },
        } = ctx
        const payload = body as Partial<CreateFeedRequest> & { createdAt?: unknown }
        const { title, alias, listed, content, summary, draft, tags, createdAt } = payload

        if (!admin) {
          set.status = 403
          return 'Permission denied'
        }
        if (uid === undefined) {
          set.status = 401
          return 'Unauthorized'
        }

        if (typeof title !== 'string' || title.length === 0) {
          set.status = 400
          return 'Title is required'
        }
        if (typeof content !== 'string' || content.length === 0) {
          set.status = 400
          return 'Content is required'
        }

        const exist = await db.query.feeds.findFirst({
          where: or(eq(feeds.title, title), eq(feeds.content, content)),
        })

        if (exist) {
          set.status = 400
          return 'Content already exists'
        }

        let date = new Date()
        if (createdAt !== undefined) {
          if (typeof createdAt !== 'string') {
            set.status = 400
            return 'Invalid createdAt: expected ISO 8601 date-time string'
          }
          try {
            date = asDate(createdAt, 'createdAt')
          } catch (error) {
            set.status = 400
            return error instanceof Error ? error.message : 'Invalid createdAt'
          }
        }

        // Generate AI summary if enabled and not a draft
        let ai_summary = ''
        if (!draft) {
          const generatedSummary = await generateAISummary(env, db, content)
          if (generatedSummary) {
            ai_summary = generatedSummary
          }
        }

        const result = await db
          .insert(feeds)
          .values({
            title,
            content,
            summary,
            ai_summary,
            uid,
            alias: typeof alias === 'string' ? alias : undefined,
            listed: listed ? 1 : 0,
            draft: draft ? 1 : 0,
            createdAt: date,
            updatedAt: date,
          })
          .returning({ insertedId: feeds.id })

        await bindTagToPost(db, result[0].insertedId, normalizedTags(tags) ?? [])
        await cache.deletePrefix('feeds_')

        if (result.length === 0) {
          set.status = 500
          return 'Failed to insert'
        } else {
          return result[0]
        }
      },
      feedCreateSchema
    )

    // GET /feed/:id
    group.get('/:id', async (ctx: Context) => {
      const {
        uid,
        admin,
        set,
        headers,
        params,
        store: { db, cache, clientConfig },
      } = ctx
      const { id } = params
      const id_num = parseInt(id, 10)
      const cacheKey = `feed_${id}`

      const feed = await cache.getOrSet(cacheKey, () =>
        db.query.feeds.findFirst({
          where: or(eq(feeds.id, id_num), eq(feeds.alias, id)),
          with: {
            hashtags: {
              columns: {},
              with: {
                hashtag: { columns: { id: true, name: true } },
              },
            },
            user: { columns: { id: true, username: true, avatar: true } },
          },
        })
      )

      if (!feed) {
        set.status = 404
        return 'Not found'
      }

      if (feed.draft && feed.uid !== uid && !admin) {
        set.status = 403
        return 'Permission denied'
      }

      const { hashtags, ...other } = feed
      const hashtags_flatten = hashtags.map(f => f.hashtag)

      // update visits using HyperLogLog for efficient UV estimation
      const enableVisit = await clientConfig.getOrDefault('counter.enabled', true)
      let pv = 0
      let uv = 0

      if (enableVisit) {
        const ip = headers['cf-connecting-ip'] || headers['x-real-ip'] || 'UNK'
        const visitorKey = `${ip}`

        // Get or create visit stats for this feed
        const stats = await db.query.visitStats.findFirst({
          where: eq(visitStats.feedId, feed.id),
        })

        if (!stats) {
          // Create new stats record
          await db.insert(visitStats).values({
            feedId: feed.id,
            pv: 1,
            hllData: new HyperLogLog().serialize(),
          })
          pv = 1
          uv = 1
        } else {
          // Update existing stats
          const hll = new HyperLogLog(stats.hllData)
          hll.add(visitorKey)
          const newHllData = hll.serialize()
          const newPv = stats.pv + 1

          await db
            .update(visitStats)
            .set({
              pv: newPv,
              hllData: newHllData,
              updatedAt: new Date(),
            })
            .where(eq(visitStats.feedId, feed.id))

          pv = newPv
          uv = Math.round(hll.count())
        }

        // Keep recording to visits table for backup/history
        await db.insert(visits).values({ feedId: feed.id, ip: ip })
      }

      return { ...other, hashtags: hashtags_flatten, pv, uv }
    })

    // GET /feed/adjacent/:id
    group.get('/adjacent/:id', async (ctx: Context) => {
      const {
        set,
        params,
        store: { db, cache },
      } = ctx
      const { id } = params
      let id_num: number

      if (Number.isNaN(parseInt(id, 10))) {
        const aliasRecord = await db.select({ id: feeds.id }).from(feeds).where(eq(feeds.alias, id))
        if (aliasRecord.length === 0) {
          set.status = 404
          return 'Not found'
        }
        id_num = aliasRecord[0].id
      } else {
        id_num = parseInt(id, 10)
      }

      const feed = await db.query.feeds.findFirst({
        where: eq(feeds.id, id_num),
        columns: { createdAt: true },
      })

      if (!feed) {
        set.status = 404
        return 'Not found'
      }

      const created_at = feed.createdAt

      function formatAndCacheData(feed: AdjacentFeed | null | undefined, feedDirection: 'previous_feed' | 'next_feed') {
        if (feed) {
          const hashtags_flatten = feed.hashtags.map(f => f.hashtag)
          const summary =
            feed.summary.length > 0 ? feed.summary : feed.content.length > 50 ? feed.content.slice(0, 50) : feed.content
          const cacheKey = `${feed.id}_${feedDirection}_${id_num}`
          const cacheData = {
            id: feed.id,
            title: feed.title,
            summary: summary,
            hashtags: hashtags_flatten,
            createdAt: feed.createdAt,
            updatedAt: feed.updatedAt,
          }
          cache.set(cacheKey, cacheData)
          return cacheData
        }
        return null
      }

      const getPreviousFeed = async () => {
        const previousFeedCached = await cache.getBySuffix(`previous_feed_${id_num}`)
        if (previousFeedCached && previousFeedCached.length > 0) {
          return previousFeedCached[0]
        } else {
          const tempPreviousFeed = await db.query.feeds.findFirst({
            where: and(and(eq(feeds.draft, 0), eq(feeds.listed, 1)), lt(feeds.createdAt, created_at)),
            orderBy: [desc(feeds.createdAt)],
            with: {
              hashtags: {
                columns: {},
                with: { hashtag: { columns: { id: true, name: true } } },
              },
              user: { columns: { id: true, username: true, avatar: true } },
            },
          })
          return formatAndCacheData(tempPreviousFeed, 'previous_feed')
        }
      }

      const getNextFeed = async () => {
        const nextFeedCached = await cache.getBySuffix(`next_feed_${id_num}`)
        if (nextFeedCached && nextFeedCached.length > 0) {
          return nextFeedCached[0]
        } else {
          const tempNextFeed = await db.query.feeds.findFirst({
            where: and(and(eq(feeds.draft, 0), eq(feeds.listed, 1)), gt(feeds.createdAt, created_at)),
            orderBy: [asc(feeds.createdAt)],
            with: {
              hashtags: {
                columns: {},
                with: { hashtag: { columns: { id: true, name: true } } },
              },
              user: { columns: { id: true, username: true, avatar: true } },
            },
          })
          return formatAndCacheData(tempNextFeed, 'next_feed')
        }
      }

      const [previousFeed, nextFeed] = await Promise.all([getPreviousFeed(), getNextFeed()])
      return { previousFeed, nextFeed }
    })

    // POST /feed/:id - Update feed
    group.post(
      '/:id',
      async (ctx: Context) => {
        const {
          admin,
          set,
          uid,
          params,
          body,
          store: { db, cache, env },
        } = ctx
        const { id } = params
        const payload = body as Partial<UpdateFeedRequest> & { createdAt?: unknown }
        const { title, listed, content, summary, alias, draft, top, tags, createdAt } = payload

        const id_num = parseInt(id, 10)
        const feed = await db.query.feeds.findFirst({ where: eq(feeds.id, id_num) })

        if (!feed) {
          set.status = 404
          return 'Not found'
        }

        if (feed.uid !== uid && !admin) {
          set.status = 403
          return 'Permission denied'
        }

        // Generate AI summary if content changed and not a draft
        let ai_summary: string | undefined
        const contentChanged = typeof content === 'string' && content !== feed.content
        const isDraft = draft !== undefined ? draft : feed.draft === 1

        if (contentChanged && !isDraft) {
          const generatedSummary = await generateAISummary(env, db, content)
          if (generatedSummary) {
            ai_summary = generatedSummary
          }
        }

        if (!isDraft && feed.draft === 1 && !feed.ai_summary) {
          const contentToSummarize = content || feed.content
          const generatedSummary = await generateAISummary(env, db, contentToSummarize)
          if (generatedSummary) {
            ai_summary = generatedSummary
          }
        }

        let parsedCreatedAt: Date | undefined
        if (createdAt !== undefined) {
          if (typeof createdAt !== 'string') {
            set.status = 400
            return 'Invalid createdAt: expected ISO 8601 date-time string'
          }
          try {
            parsedCreatedAt = asDate(createdAt, 'createdAt')
          } catch (error) {
            set.status = 400
            return error instanceof Error ? error.message : 'Invalid createdAt'
          }
        }

        await db
          .update(feeds)
          .set({
            title: typeof title === 'string' ? title : undefined,
            content: typeof content === 'string' ? content : undefined,
            summary: typeof summary === 'string' ? summary : undefined,
            ai_summary,
            alias: typeof alias === 'string' ? alias : undefined,
            top: typeof top === 'number' ? top : undefined,
            listed: listed === undefined ? undefined : listed ? 1 : 0,
            draft: draft === undefined ? undefined : draft ? 1 : 0,
            createdAt: parsedCreatedAt,
            updatedAt: new Date(),
          })
          .where(eq(feeds.id, id_num))

        const normalizedUpdateTags = normalizedTags(tags)
        if (normalizedUpdateTags) {
          await bindTagToPost(db, id_num, normalizedUpdateTags)
        }

        await clearFeedCache(cache, id_num, feed.alias, typeof alias === 'string' ? alias : null)
        return 'Updated'
      },
      feedUpdateSchema
    )

    // POST /feed/top/:id
    group.post(
      '/top/:id',
      async (ctx: Context) => {
        const {
          admin,
          set,
          uid,
          params,
          body,
          store: { db, cache },
        } = ctx
        const { id } = params
        const { top } = body as Partial<{ top: number }>

        if (typeof top !== 'number') {
          set.status = 400
          return 'Top value is required'
        }

        const id_num = parseInt(id, 10)
        const feed = await db.query.feeds.findFirst({ where: eq(feeds.id, id_num) })

        if (!feed) {
          set.status = 404
          return 'Not found'
        }

        if (feed.uid !== uid && !admin) {
          set.status = 403
          return 'Permission denied'
        }

        await db.update(feeds).set({ top }).where(eq(feeds.id, feed.id))
        await clearFeedCache(cache, feed.id, null, null)
        return 'Updated'
      },
      feedSetTopSchema
    )

    // DELETE /feed/:id
    group.delete('/:id', async (ctx: Context) => {
      const {
        admin,
        set,
        uid,
        params,
        store: { db, cache },
      } = ctx
      const { id } = params

      const id_num = parseInt(id, 10)
      const feed = await db.query.feeds.findFirst({ where: eq(feeds.id, id_num) })

      if (!feed) {
        set.status = 404
        return 'Not found'
      }

      if (feed.uid !== uid && !admin) {
        set.status = 403
        return 'Permission denied'
      }

      await db.delete(feeds).where(eq(feeds.id, id_num))
      await clearFeedCache(cache, id_num, feed.alias, null)
      return 'Deleted'
    })
  })

  // GET /search/:keyword
  router.get(
    '/search/:keyword',
    async (ctx: Context) => {
      const {
        admin,
        params,
        query,
        store: { db, cache },
      } = ctx
      let { keyword } = params
      const { page, limit } = query
      const pageValue = queryValue(page)
      const limitValue = queryValue(limit)

      keyword = decodeURI(keyword)
      const page_num = (pageValue ? (parseInt(pageValue, 10) > 0 ? parseInt(pageValue, 10) : 1) : 1) - 1
      const limit_num = limitValue ? (parseInt(limitValue, 10) > 50 ? 50 : parseInt(limitValue, 10)) : 20

      if (keyword === undefined || keyword.trim().length === 0) {
        return { size: 0, data: [], hasNext: false }
      }

      const cacheKey = `search_${keyword}`
      const searchKeyword = `%${keyword}%`
      const whereClause = or(
        like(feeds.title, searchKeyword),
        like(feeds.content, searchKeyword),
        like(feeds.summary, searchKeyword),
        like(feeds.alias, searchKeyword)
      )

      const feed_list = (
        await cache.getOrSet(cacheKey, () =>
          db.query.feeds.findMany({
            where: admin ? whereClause : and(whereClause, eq(feeds.draft, 0)),
            columns: admin ? undefined : { draft: false, listed: false },
            with: {
              hashtags: {
                columns: {},
                with: { hashtag: { columns: { id: true, name: true } } },
              },
              user: { columns: { id: true, username: true, avatar: true } },
            },
            orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
          })
        )
      ).map(({ content, hashtags, summary, ...other }) => {
        return {
          summary: summary.length > 0 ? summary : content.length > 100 ? content.slice(0, 100) : content,
          hashtags: hashtags.map(({ hashtag }) => hashtag),
          ...other,
        }
      })

      if (feed_list.length <= page_num * limit_num) {
        return { size: feed_list.length, data: [], hasNext: false }
      } else if (feed_list.length <= page_num * limit_num + limit_num) {
        return { size: feed_list.length, data: feed_list.slice(page_num * limit_num), hasNext: false }
      } else {
        return {
          size: feed_list.length,
          data: feed_list.slice(page_num * limit_num, page_num * limit_num + limit_num),
          hasNext: true,
        }
      }
    },
    searchSchema
  )

  // POST /wp - WordPress import
  router.post(
    '/wp',
    async (ctx: Context) => {
      const {
        set,
        admin,
        body,
        store: { db, cache },
      } = ctx
      const { data } = body

      if (!admin) {
        set.status = 403
        return 'Permission denied'
      }

      if (!(data instanceof Blob)) {
        set.status = 400
        return 'Data is required'
      }

      // Initialize WordPress import modules lazily
      await initWPModules()
      if (!XMLParser) {
        throw new Error('XML parser is unavailable')
      }

      const xml = await data.text()
      const parser = new XMLParser()
      const result = parser.parse(xml)
      const parsed = result as { rss?: { channel?: { item?: WordPressItem[] | WordPressItem } } }
      const itemsRaw = parsed.rss?.channel?.item
      const items = Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : []

      if (items.length === 0) {
        set.status = 404
        return 'No items found'
      }

      const feedItems: FeedItem[] = items.map((item: WordPressItem) => {
        const createdAtSource = typeof item['wp:post_date'] === 'string' ? item['wp:post_date'] : undefined
        const updatedAtSource = typeof item['wp:post_modified'] === 'string' ? item['wp:post_modified'] : undefined
        const createdAt = createdAtSource ? new Date(createdAtSource) : new Date()
        const updatedAt = updatedAtSource ? new Date(updatedAtSource) : createdAt
        const draft = item['wp:status'] !== 'publish'
        const contentHtml = typeof item['content:encoded'] === 'string' ? item['content:encoded'] : ''
        const content = html2md ? html2md(contentHtml || '') : contentHtml || ''
        const summary = content.length > 100 ? content.slice(0, 100) : content
        let tags: string[] | undefined
        if (Array.isArray(item.category)) {
          tags = item.category.map(tag => `${tag}`)
        } else if (typeof item.category === 'string') {
          tags = [item.category]
        }

        return {
          title: typeof item.title === 'string' ? item.title : '',
          summary,
          content,
          draft,
          createdAt,
          updatedAt,
          tags,
        }
      })

      let success = 0
      let skipped = 0
      const skippedList: { title: string; reason: string }[] = []

      for (const item of feedItems) {
        if (!item.content) {
          skippedList.push({ title: item.title, reason: 'no content' })
          skipped++
          continue
        }

        const exist = await db.query.feeds.findFirst({ where: eq(feeds.content, item.content) })
        if (exist) {
          skippedList.push({ title: item.title, reason: 'content exists' })
          skipped++
          continue
        }

        const result = await db
          .insert(feeds)
          .values({
            title: item.title,
            content: item.content,
            summary: item.summary,
            uid: 1,
            listed: 1,
            draft: item.draft ? 1 : 0,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          })
          .returning({ insertedId: feeds.id })

        if (item.tags) {
          await bindTagToPost(db, result[0].insertedId, item.tags)
        }
        success++
      }

      cache.deletePrefix('feeds_')
      return { success, skipped, skippedList }
    },
    wpImportSchema
  )
}

type FeedItem = {
  title: string
  summary: string
  content: string
  draft: boolean
  createdAt: Date
  updatedAt: Date
  tags?: string[]
}

async function clearFeedCache(cache: CacheImpl, id: number, alias: string | null, newAlias: string | null) {
  await cache.deletePrefix('feeds_')
  await cache.deletePrefix('search_')
  await cache.delete(`feed_${id}`, false)
  await cache.deletePrefix(`${id}_previous_feed`)
  await cache.deletePrefix(`${id}_next_feed`)
  if (alias === newAlias) return
  if (alias) await cache.delete(`feed_${alias}`, false)
  if (newAlias) await cache.delete(`feed_${newAlias}`, false)
}
