import { friendCreateSchema, friendUpdateSchema } from '@rin/api'
import type { CreateFriendRequest, UpdateFriendRequest } from '@rin/api'
import { eq } from 'drizzle-orm'
import type { Router } from '../core/router'
import type { Context } from '../core/types'
import * as schema from '../db/schema'
import { friends } from '../db/schema'
import type { DB } from '../server'
import type { CacheImpl } from '../utils/cache'
import { Config } from '../utils/config'
import { notify } from '../utils/webhook'

export function FriendService(router: Router): void {
  const toNonEmptyString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
      return undefined
    }
    return value.length > 0 ? value : undefined
  }

  router.group('/friend', group => {
    // GET /friend
    group.get('/', async (ctx: Context) => {
      const {
        admin,
        uid,
        store: { db },
      } = ctx

      const friend_list = await (admin
        ? db.query.friends.findMany({
            orderBy: (friends, { asc, desc }) => [desc(friends.sort_order), asc(friends.createdAt)],
          })
        : db.query.friends.findMany({
            where: eq(friends.accepted, 1),
            orderBy: (friends, { asc, desc }) => [desc(friends.sort_order), asc(friends.createdAt)],
          }))

      const apply_list = uid ? await db.query.friends.findFirst({ where: eq(friends.uid, uid) }) : null
      return { friend_list, apply_list }
    })

    // POST /friend
    group.post(
      '/',
      async (ctx: Context) => {
        const {
          admin,
          uid,
          username,
          set,
          body,
          store: { db, env, clientConfig, serverConfig },
        } = ctx
        const payload = body as Partial<CreateFriendRequest>
        const name = toNonEmptyString(payload.name)
        const desc = toNonEmptyString(payload.desc)
        const avatar = toNonEmptyString(payload.avatar)
        const url = toNonEmptyString(payload.url)

        const enable = await clientConfig.getOrDefault('friend_apply_enable', true)
        if (!enable && !admin) {
          set.status = 403
          return 'Friend Link Apply Disabled'
        }

        if (!name || !desc || !avatar || !url) {
          set.status = 400
          return 'Invalid input'
        }

        if (name.length > 20 || desc.length > 100 || avatar.length > 100 || url.length > 100) {
          set.status = 400
          return 'Invalid input'
        }

        if (!uid) {
          set.status = 401
          return 'Unauthorized'
        }

        if (!admin) {
          const exist = await db.query.friends.findFirst({ where: eq(friends.uid, uid) })
          if (exist) {
            set.status = 400
            return 'Already sent'
          }
        }

        const accepted = admin ? 1 : 0
        await db.insert(friends).values({
          name,
          desc,
          avatar,
          url,
          uid: uid,
          accepted,
        })

        if (!admin) {
          const webhookUrlValue = await serverConfig.get(Config.webhookUrl)
          const webhookUrl =
            typeof webhookUrlValue === 'string' && webhookUrlValue.length > 0 ? webhookUrlValue : env.WEBHOOK_URL
          const frontendUrl = ctx.url.origin
          const content = `${frontendUrl}/friends\n${username} 申请友链: ${name}\n${desc}\n${url}`
          await notify(webhookUrl, content)
        }
        return 'OK'
      },
      friendCreateSchema
    )

    // PUT /friend/:id
    group.put(
      '/:id',
      async (ctx: Context) => {
        const {
          admin,
          uid,
          username,
          set,
          params,
          body,
          store: { db, env, clientConfig, serverConfig },
        } = ctx
        const payload = body as Partial<UpdateFriendRequest>
        const { accepted, sort_order } = payload
        const name = toNonEmptyString(payload.name)
        const desc = toNonEmptyString(payload.desc)
        const avatar = toNonEmptyString(payload.avatar)
        const url = toNonEmptyString(payload.url)

        const enable = await clientConfig.getOrDefault('friend_apply_enable', true)
        if (!enable && !admin) {
          set.status = 403
          return 'Friend Link Apply Disabled'
        }

        if (!uid) {
          set.status = 401
          return 'Unauthorized'
        }

        const exist = await db.query.friends.findFirst({ where: eq(friends.id, parseInt(params.id, 10)) })
        if (!exist) {
          set.status = 404
          return 'Not found'
        }

        if (!admin && exist.uid !== uid) {
          set.status = 403
          return 'Permission denied'
        }

        if (!name || !desc || !url) {
          set.status = 400
          return 'Invalid input'
        }

        let finalAccepted = accepted
        let finalSortOrder = sort_order

        if (!admin) {
          finalAccepted = 0
          finalSortOrder = undefined
        }

        await db
          .update(friends)
          .set({
            name,
            desc,
            avatar,
            url,
            accepted: finalAccepted === undefined ? undefined : finalAccepted,
            sort_order: finalSortOrder === undefined ? undefined : finalSortOrder,
          })
          .where(eq(friends.id, parseInt(params.id, 10)))

        if (!admin) {
          const webhookUrlValue = await serverConfig.get(Config.webhookUrl)
          const webhookUrl =
            typeof webhookUrlValue === 'string' && webhookUrlValue.length > 0 ? webhookUrlValue : env.WEBHOOK_URL
          const frontendUrl = ctx.url.origin
          const content = `${frontendUrl}/friends\n${username} 更新友链: ${name}\n${desc}\n${url}`
          await notify(webhookUrl, content)
        }
        return 'OK'
      },
      friendUpdateSchema
    )

    // DELETE /friend/:id
    group.delete('/:id', async (ctx: Context) => {
      const {
        admin,
        uid,
        set,
        params,
        store: { db },
      } = ctx

      if (!uid) {
        set.status = 401
        return 'Unauthorized'
      }

      const exist = await db.query.friends.findFirst({ where: eq(friends.id, parseInt(params.id, 10)) })
      if (!exist) {
        set.status = 404
        return 'Not found'
      }

      if (!admin && exist.uid !== uid) {
        set.status = 403
        return 'Permission denied'
      }

      await db.delete(friends).where(eq(friends.id, parseInt(params.id, 10)))
      return 'OK'
    })
  })
}

export async function friendCrontab(
  _env: Env,
  ctx: ExecutionContext,
  db: DB,
  _cache: CacheImpl,
  serverConfig: CacheImpl,
  _clientConfig: CacheImpl
) {
  const enable = await serverConfig.getOrDefault('friend_crontab', true)
  const ua = (await serverConfig.get('friend_ua')) || 'Rin-Check/0.1.0'
  const userAgent = typeof ua === 'string' && ua.length > 0 ? ua : 'Rin-Check/0.1.0'

  if (!enable) {
    console.info('friend crontab disabled')
    return
  }

  const friend_list = await db.query.friends.findMany()
  console.info(`total friends: ${friend_list.length}`)

  let health = 0
  let unhealthy = 0

  for (const friend of friend_list) {
    console.info(`checking ${friend.name}: ${friend.url}`)
    try {
      const response = await fetch(
        new Request(friend.url, {
          method: 'GET',
          headers: { 'User-Agent': userAgent },
        })
      )
      console.info(`response status: ${response.status}`)
      console.info(`response statusText: ${response.statusText}`)

      if (response.ok) {
        ctx.waitUntil(db.update(schema.friends).set({ health: '' }).where(eq(schema.friends.id, friend.id)))
        health++
      } else {
        ctx.waitUntil(
          db
            .update(schema.friends)
            .set({ health: `${response.status}` })
            .where(eq(schema.friends.id, friend.id))
        )
        unhealthy++
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(message)
      ctx.waitUntil(db.update(schema.friends).set({ health: message }).where(eq(schema.friends.id, friend.id)))
      unhealthy++
    }
  }

  console.info(`update friends health done. Total: ${health + unhealthy}, Healthy: ${health}, Unhealthy: ${unhealthy}`)
}
