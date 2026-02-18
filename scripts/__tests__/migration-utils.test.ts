import { describe, expect, it } from 'bun:test'
import { isKnownTopColumnCatchUpCase } from '../migration-utils'

describe('isKnownTopColumnCatchUpCase', () => {
  it('matches the known duplicate top-column catch-up case for 0009.sql', () => {
    const output = 'SQLITE_ERROR: duplicate column name: top\nALTER TABLE `feeds` ADD COLUMN `top` INTEGER'
    expect(isKnownTopColumnCatchUpCase('0009.sql', output)).toBe(true)
  })

  it('matches wrangler output that omits SQL statement text', () => {
    const output = 'duplicate column name: top: SQLITE_ERROR'
    expect(isKnownTopColumnCatchUpCase('0009.sql', output)).toBe(true)
  })

  it('does not match when migration file is not 0009.sql', () => {
    const output = 'SQLITE_ERROR: duplicate column name: top\nALTER TABLE feeds ADD COLUMN top INTEGER'
    expect(isKnownTopColumnCatchUpCase('0010.sql', output)).toBe(false)
  })

  it('does not match when error text is unrelated', () => {
    const output = 'SQLITE_ERROR: no such column: top'
    expect(isKnownTopColumnCatchUpCase('0009.sql', output)).toBe(false)
  })
})
