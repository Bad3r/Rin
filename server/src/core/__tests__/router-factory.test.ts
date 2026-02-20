import { describe, expect, it } from 'vitest'
import type { Router } from '../router-contract'
import { createRouterWithFactory } from '../router-factory'

describe('createRouterWithFactory', () => {
  it('always creates the hono router implementation', () => {
    const expected = {} as Router
    let calls = 0

    const router = createRouterWithFactory(undefined, {
      createHono: () => {
        calls++
        return expected
      },
    })

    expect(router).toBe(expected)
    expect(calls).toBe(1)
  })

  it('throws when hono router creation fails', () => {
    const expected = new Error('hono init failed')

    expect(() =>
      createRouterWithFactory(undefined, {
        createHono: () => {
          throw expected
        },
      })
    ).toThrow(expected)
  })
})
