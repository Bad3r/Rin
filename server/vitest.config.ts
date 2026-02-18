import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'
import { fileURLToPath } from 'node:url'
import { createOutboundServiceGuard } from './tests/helpers/network-guard'

const migrationsPath = fileURLToPath(new URL('./sql', import.meta.url))
const d1Migrations = await readD1Migrations(migrationsPath)

export default defineWorkersConfig({
  test: {
    setupFiles: ['./tests/helpers/no-network.ts', './tests/setup/apply-d1-migrations.ts'],
    provide: {
      d1Migrations,
    },
    poolOptions: {
      workers: {
        isolatedStorage: true,
        main: './src/_worker.ts',
        miniflare: {
          outboundService: createOutboundServiceGuard(),
          compatibilityDate: '2026-01-20',
          ai: {
            binding: 'AI',
          },
          d1Databases: {
            DB: 'rin-test-db',
          },
          bindings: {
            S3_FOLDER: 'images/',
            S3_CACHE_FOLDER: 'cache/',
            S3_REGION: 'auto',
            S3_ENDPOINT: 'https://s3.invalid',
            S3_ACCESS_HOST: 'https://assets.invalid',
            S3_BUCKET: 'your-bucket-name',
            S3_FORCE_PATH_STYLE: 'false',
            WEBHOOK_URL: '',
            RSS_TITLE: 'Test Blog',
            RSS_DESCRIPTION: 'Test Environment',
            RIN_GITHUB_CLIENT_ID: 'test-client-id',
            RIN_GITHUB_CLIENT_SECRET: 'test-client-secret',
            ADMIN_USERNAME: '',
            ADMIN_PASSWORD: '',
            JWT_SECRET: 'test-jwt-secret',
            S3_ACCESS_KEY_ID: 'test-access-key',
            S3_SECRET_ACCESS_KEY: 'test-secret-key',
            CACHE_STORAGE_MODE: 'database',
            ROUTER_IMPL: 'hono',
          },
        },
      },
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'lcov'],
    },
  },
})
