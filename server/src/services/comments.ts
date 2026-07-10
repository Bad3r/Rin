import { commentCreateSchema } from '@rin/api'
import type { CreateCommentRequest } from '@rin/api'
import { desc, eq } from 'drizzle-orm'
import type { Router } from '../core/router'
import type { Context } from '../core/types'
import { comments, feeds, users } from '../db/schema'
import { Config } from '../utils/config'
import { notify } from '../utils/webhook'

// The guest website is stored for public display as a link; only http(s) may reach an href.
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function CommentService(router: Router): void {
  router.group('/comment', group => {
    group.get('/:feed', async (ctx: Context) => {
      const {
        params,
        store: { db },
      } = ctx
      const feedId = parseInt(params.feed, 10)

      // guestEmail is collected for the author's benefit only; never expose it publicly.
      const comment_list = await db.query.comments.findMany({
        where: eq(comments.feedId, feedId),
        columns: { feedId: false, userId: false, guestEmail: false },
        with: {
          user: {
            columns: { id: true, username: true, avatar: true, permission: true },
          },
        },
        orderBy: [desc(comments.createdAt)],
      })

      return comment_list.map(comment => ({
        ...comment,
        user: comment.user ?? null,
        guestName: comment.guestName || '',
        guestWebsite: comment.guestWebsite || '',
      }))
    })

    group.post(
      '/:feed',
      async (ctx: Context) => {
        const {
          uid,
          set,
          params,
          body,
          store: { db, env, serverConfig },
        } = ctx
        const { content, guestName, guestEmail, guestWebsite } = body as Partial<CreateCommentRequest>

        if (typeof content !== 'string' || content.length === 0) {
          set.status = 400
          return 'Content is required'
        }

        const feedId = parseInt(params.feed, 10)
        const exist = await db.query.feeds.findFirst({ where: eq(feeds.id, feedId) })
        if (!exist) {
          set.status = 400
          return 'Feed not found'
        }

        let notifyLine: string
        if (uid !== undefined) {
          const user = await db.query.users.findFirst({ where: eq(users.id, uid) })
          if (!user) {
            set.status = 400
            return 'User not found'
          }

          await db.insert(comments).values({
            feedId,
            userId: uid,
            content,
          })
          notifyLine = `${user.username} 评论了: ${exist.title}`
        } else {
          const trimmedGuestName = typeof guestName === 'string' ? guestName.trim() : ''
          if (!trimmedGuestName) {
            set.status = 400
            return 'Guest name is required'
          }

          const trimmedGuestWebsite = typeof guestWebsite === 'string' ? guestWebsite.trim() : ''
          if (trimmedGuestWebsite && !isHttpUrl(trimmedGuestWebsite)) {
            set.status = 400
            return 'Guest website must be an http(s) URL'
          }

          await db.insert(comments).values({
            feedId,
            userId: null,
            content,
            guestName: trimmedGuestName,
            guestEmail: typeof guestEmail === 'string' ? guestEmail.trim() : '',
            guestWebsite: trimmedGuestWebsite,
            approved: 1,
          })
          notifyLine = `游客 ${trimmedGuestName} 评论了: ${exist.title}`
        }

        const webhookUrlValue = await serverConfig.get(Config.webhookUrl)
        const webhookUrl =
          typeof webhookUrlValue === 'string' && webhookUrlValue.length > 0 ? webhookUrlValue : env.WEBHOOK_URL
        const frontendUrl = ctx.url.origin
        try {
          await notify(webhookUrl, `${frontendUrl}/feed/${feedId}\n${notifyLine}\n${content}`)
        } catch (error) {
          // The comment is already stored; webhook delivery failures must not fail the request (upstream #474).
          console.error('[Comment] Webhook notification failed:', error)
        }
        return 'OK'
      },
      commentCreateSchema
    )

    group.delete('/:id', async (ctx: Context) => {
      const {
        uid,
        admin,
        set,
        params,
        store: { db },
      } = ctx

      if (uid === undefined) {
        set.status = 401
        return 'Unauthorized'
      }

      const id_num = parseInt(params.id, 10)
      const comment = await db.query.comments.findFirst({ where: eq(comments.id, id_num) })

      if (!comment) {
        set.status = 404
        return 'Not found'
      }

      if (!admin && comment.userId !== uid) {
        set.status = 403
        return 'Permission denied'
      }

      await db.delete(comments).where(eq(comments.id, id_num))
      return 'OK'
    })
  })
}
