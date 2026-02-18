import { describe, expect, it } from 'bun:test'
import { isKnownTopColumnCatchUpCase } from '../migration-utils'

describe('isKnownTopColumnCatchUpCase', () => {
  it('matches the known duplicate top-column catch-up case for 0009.sql', () => {
    const output = 'SQLITE_ERROR: duplicate column name: top\nALTER TABLE `feeds` ADD COLUMN `top` INTEGER'
    expect(isKnownTopColumnCatchUpCase('0009.sql', output)).toBe(true)
  })

  it('does not match when migration file is not 0009.sql', () => {
    const output = 'SQLITE_ERROR: duplicate column name: top\nALTER TABLE feeds ADD COLUMN top INTEGER'
    expect(isKnownTopColumnCatchUpCase('0010.sql', output)).toBe(false)
  })

  it('does not match non-add-column ALTER TABLE operations', () => {
    const output = 'SQLITE_ERROR: duplicate column name: top\nALTER TABLE feeds DROP COLUMN top'
    expect(isKnownTopColumnCatchUpCase('0009.sql', output)).toBe(false)
  })

  it('does not match duplicate top-column output for non-feeds tables', () => {
    const output = 'SQLITE_ERROR: duplicate column name: top\nALTER TABLE posts ADD COLUMN top INTEGER'
    expect(isKnownTopColumnCatchUpCase('0009.sql', output)).toBe(false)
  })
})
