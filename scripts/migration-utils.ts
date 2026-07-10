const TOP_COLUMN_CATCH_UP_MIGRATION_FILE = '0011.sql'
const DUPLICATE_TOP_COLUMN_PATTERN = /duplicate column name\s*:?\s*top\b/

export function isKnownTopColumnCatchUpCase(file: string, output: string): boolean {
  const normalizedOutput = output.toLowerCase()
  // Wrangler output for this failure mode can omit SQL text and only return:
  // "duplicate column name: top: SQLITE_ERROR"
  return file === TOP_COLUMN_CATCH_UP_MIGRATION_FILE && DUPLICATE_TOP_COLUMN_PATTERN.test(normalizedOutput)
}

// The 2026-07 realignment renumbered fork migrations (old 0009-0011 became 0011-0013) and adopted
// upstream 0009/0010. A database stamped 9-12 by the OLD numbering lacks the guest-comment schema
// that the new 0010 creates; pure number gating would silently skip the new 0009/0010 there.
// Such databases must be reset to migration_version 8 first (FORK.md, Outstanding follow-ups).
export function isIncompatibleOldNumberingState(migrationVersion: number, hasGuestColumn: boolean): boolean {
  return migrationVersion >= 9 && migrationVersion < 13 && !hasGuestColumn
}

export const OLD_NUMBERING_ABORT_MESSAGE =
  'migration_version predates the 2026-07 migration renumbering: number gating would silently skip ' +
  'the new 0009/0010 (AI summary columns, guest comments rebuild). Reset migration_version to 8 and ' +
  'rerun; see FORK.md, Outstanding follow-ups.'
