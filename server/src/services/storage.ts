import type { Router } from '../core/router'
import type { Context } from '../core/types'
import { path_join } from '../utils/path'
import { createS3Client, putObject } from '../utils/s3'

function buf2hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('')
}

export function StorageService(router: Router): void {
  router.group('/storage', group => {
    // POST /storage
    group.post(
      '/',
      async (ctx: Context) => {
        const {
          uid,
          set,
          body,
          store: { env },
        } = ctx
        const keyValue = body.key
        const fileValue = body.file

        const endpoint = env.S3_ENDPOINT
        const bucket = env.S3_BUCKET
        const folder = env.S3_FOLDER || ''
        const accessHost = env.S3_ACCESS_HOST || endpoint
        const accessKeyId = env.S3_ACCESS_KEY_ID
        const secretAccessKey = env.S3_SECRET_ACCESS_KEY
        const s3 = createS3Client(env)

        if (!endpoint) {
          set.status = 500
          return 'S3_ENDPOINT is not defined'
        }
        if (!accessKeyId) {
          set.status = 500
          return 'S3_ACCESS_KEY_ID is not defined'
        }
        if (!secretAccessKey) {
          set.status = 500
          return 'S3_SECRET_ACCESS_KEY is not defined'
        }
        if (!bucket) {
          set.status = 500
          return 'S3_BUCKET is not defined'
        }
        if (!uid) {
          set.status = 401
          return 'Unauthorized'
        }
        if (typeof keyValue !== 'string' || keyValue.length === 0) {
          set.status = 400
          return 'Invalid key'
        }
        if (!(fileValue instanceof Blob)) {
          set.status = 400
          return 'Invalid file'
        }

        const suffix = keyValue.includes('.') ? keyValue.split('.').pop() : ''
        const hashArray = await crypto.subtle.digest({ name: 'SHA-1' }, await fileValue.arrayBuffer())
        const hash = buf2hex(hashArray)
        const hashkey = path_join(folder, `${hash}.${suffix}`)

        try {
          await putObject(s3, env, hashkey, fileValue, fileValue.type)
          return `${accessHost}/${hashkey}`
        } catch (e: unknown) {
          set.status = 400
          const message = e instanceof Error ? e.message : String(e)
          console.error(message)
          return message
        }
      },
      {
        type: 'object',
        properties: {
          key: { type: 'string' },
          file: { type: 'file' },
        },
      }
    )
  })
}
