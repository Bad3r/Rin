import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMockEnv, execSql } from '../../../tests/fixtures'
import { users } from '../../db/schema'
import { createBaseApp } from '../base'
import type { Context } from '../types'

describe('createBaseApp D1 adapter integration', () => {
  let app: ReturnType<typeof createBaseApp>
  let env: Env

  beforeEach(() => {
    env = createMockEnv()
    app = createBaseApp(env)
  })

  it('queries through runtime drizzle-orm/d1 import and preserves mapped row types', async () => {
    const userId = 9911
    await execSql(
      env.DB,
      `
        INSERT INTO users (id, username, avatar, openid, permission)
        VALUES (${userId}, 'adapter-user', 'avatar.png', 'gh_adapter_user', 1)
      `
    )

    app.get('/__d1-adapter-check', async (ctx: Context) => {
      const user = await ctx.store.db.query.users.findFirst({
        where: eq(users.id, userId),
      })

      if (!user) {
        ctx.set.status = 500
        return { error: 'expected user row from D1 adapter query' }
      }

      const selected = await ctx.store.db
        .select({
          userId: users.id,
          permission: users.permission,
        })
        .from(users)
        .where(eq(users.id, userId))
        .get()

      if (!selected) {
        ctx.set.status = 500
        return { error: 'expected selected row from D1 adapter query' }
      }

      return {
        id: user.id,
        username: user.username,
        permission: selected.permission,
        idType: typeof user.id,
        permissionType: typeof selected.permission,
      }
    })

    const response = await app.handle(new Request('https://example.test/__d1-adapter-check'), env)
    expect(response.status).toBe(200)

    const payload = (await response.json()) as {
      id: number
      username: string
      permission: number
      idType: string
      permissionType: string
    }

    expect(payload.id).toBe(userId)
    expect(payload.username).toBe('adapter-user')
    expect(payload.permission).toBe(1)
    expect(payload.idType).toBe('number')
    expect(payload.permissionType).toBe('number')
  })
})
