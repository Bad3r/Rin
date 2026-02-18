import { describe, expect, it } from 'vitest'

describe('no-network preload guard', () => {
  it('blocks outbound HTTP fetches during local test tiers', async () => {
    let thrown: unknown

    try {
      await fetch('https://example.com')
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeDefined()
    expect((thrown as Error).message).toContain('[test-network-guard] Blocked outbound fetch')
  })
})
