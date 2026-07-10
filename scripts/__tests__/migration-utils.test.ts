import { describe, expect, it } from 'bun:test'
import { isIncompatibleOldNumberingState, isKnownTopColumnCatchUpCase } from '../migration-utils'

describe('isKnownTopColumnCatchUpCase', () => {
  it('matches the known duplicate top-column catch-up case for 0011.sql', () => {
    const output = 'SQLITE_ERROR: duplicate column name: top\nALTER TABLE `feeds` ADD COLUMN `top` INTEGER'
    expect(isKnownTopColumnCatchUpCase('0011.sql', output)).toBe(true)
  })

  it('matches wrangler output that omits SQL statement text', () => {
    const output = 'duplicate column name: top: SQLITE_ERROR'
    expect(isKnownTopColumnCatchUpCase('0011.sql', output)).toBe(true)
  })

  it('does not match when migration file is not 0011.sql', () => {
    const output = 'SQLITE_ERROR: duplicate column name: top\nALTER TABLE feeds ADD COLUMN top INTEGER'
    expect(isKnownTopColumnCatchUpCase('0009.sql', output)).toBe(false)
  })

  it('does not match when error text is unrelated', () => {
    const output = 'SQLITE_ERROR: no such column: top'
    expect(isKnownTopColumnCatchUpCase('0011.sql', output)).toBe(false)
  })
})

describe('isIncompatibleOldNumberingState', () => {
  it('flags old-numbering versions 9-12 without the guest column', () => {
    for (const version of [9, 10, 11, 12]) {
      expect(isIncompatibleOldNumberingState(version, false)).toBe(true)
    }
  })

  it('accepts versions 9-12 when the guest column exists (new numbering mid-state)', () => {
    for (const version of [9, 10, 11, 12]) {
      expect(isIncompatibleOldNumberingState(version, true)).toBe(false)
    }
  })

  it('accepts versions outside the collision window regardless of the marker', () => {
    expect(isIncompatibleOldNumberingState(8, false)).toBe(false)
    expect(isIncompatibleOldNumberingState(13, false)).toBe(false)
    expect(isIncompatibleOldNumberingState(-1, false)).toBe(false)
  })
})
