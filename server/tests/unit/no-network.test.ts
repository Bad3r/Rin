import { describe, expect, it } from 'vitest'
import { createOutboundServiceGuard } from '../helpers/network-guard'

describe('no-network preload guard', () => {
  it('blocks outbound HTTP fetches during local test tiers', async () => {
    const guard = createOutboundServiceGuard({})
    expect(guard).toBeTypeOf('function')
    await expect((guard as NonNullable<typeof guard>)(new Request('https://example.com'))).rejects.toThrow(
      '[test-network-guard] Blocked outbound fetch'
    )
  })

  it('allows outbound fetches for remote-tier runs', () => {
    expect(createOutboundServiceGuard({ RIN_TEST_TIER: 'remote' })).toBeUndefined()
  })
})
