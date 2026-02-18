const TOP_COLUMN_CATCH_UP_MIGRATION_FILE = '0009.sql'
const DUPLICATE_TOP_COLUMN_PATTERN = /duplicate column name\s*:?\s*top\b/
const FEEDS_ADD_COLUMN_PATTERN = /alter table\s+`?feeds`?\s+add column\b/

export function isKnownTopColumnCatchUpCase(file: string, output: string): boolean {
  const normalizedOutput = output.toLowerCase()
  return (
    file === TOP_COLUMN_CATCH_UP_MIGRATION_FILE &&
    DUPLICATE_TOP_COLUMN_PATTERN.test(normalizedOutput) &&
    FEEDS_ADD_COLUMN_PATTERN.test(normalizedOutput)
  )
}
