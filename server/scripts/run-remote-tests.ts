import { fileURLToPath } from 'node:url'

const enabled = (process.env.ENABLE_REMOTE_INTEGRATION_TESTS || '').toLowerCase()

if (enabled !== 'true') {
  console.log('[remote-tests] Skipping: ENABLE_REMOTE_INTEGRATION_TESTS is not true.')
  process.exit(0)
}

if (!process.env.RIN_REMOTE_BASE_URL) {
  console.error('[remote-tests] RIN_REMOTE_BASE_URL is required when remote tests are enabled.')
  process.exit(1)
}

const serverRoot = fileURLToPath(new URL('..', import.meta.url))

const proc = Bun.spawn(['bun', 'x', 'vitest', 'run', '--config', 'vitest.config.ts', 'tests/remote'], {
  cwd: serverRoot,
  stdout: 'inherit',
  stderr: 'inherit',
  env: {
    ...process.env,
    RIN_TEST_TIER: 'remote',
  },
})

process.exit(await proc.exited)
