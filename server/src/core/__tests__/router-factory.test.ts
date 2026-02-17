import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { resolveRouterImpl } from '../router-factory'

describe('resolveRouterImpl', () => {
  let originalWarn: typeof console.warn
  let warnings: string[]

  beforeEach(() => {
    originalWarn = console.warn
    warnings = []
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(value => String(value)).join(' '))
    }
  })

  afterEach(() => {
    console.warn = originalWarn
  })

  it('returns explicit valid env values', () => {
    expect(resolveRouterImpl({ ROUTER_IMPL: 'legacy' })).toBe('legacy')
    expect(resolveRouterImpl({ ROUTER_IMPL: 'hono' })).toBe('hono')
  })

  it('defaults to hono when ROUTER_IMPL is not set', () => {
    expect(resolveRouterImpl({})).toBe('hono')
    expect(resolveRouterImpl(undefined)).toBe('hono')
    expect(warnings.length).toBe(0)
  })

  it('falls back to hono and warns on invalid values', () => {
    expect(resolveRouterImpl({ ROUTER_IMPL: 'invalid' as any })).toBe('hono')
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain('Invalid ROUTER_IMPL "invalid"')
    expect(warnings[0]).toContain('falling back to hono')
  })

  it('does not implicitly read process.env', () => {
    if (typeof process === 'undefined') {
      return
    }

    const originalProcessValue = process.env.ROUTER_IMPL
    process.env.ROUTER_IMPL = 'legacy'

    try {
      expect(resolveRouterImpl(undefined)).toBe('hono')
    } finally {
      if (originalProcessValue === undefined) {
        delete process.env.ROUTER_IMPL
      } else {
        process.env.ROUTER_IMPL = originalProcessValue
      }
    }
  })
})
