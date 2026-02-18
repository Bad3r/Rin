const TOP_COLUMN_CATCH_UP_MIGRATION_FILE = '0009.sql'
const DUPLICATE_TOP_COLUMN_PATTERN = /duplicate column name\s*:?\s*top\b/

export function isKnownTopColumnCatchUpCase(file: string, output: string): boolean {
  const normalizedOutput = output.toLowerCase()
  // Wrangler output for this failure mode can omit SQL text and only return:
  // "duplicate column name: top: SQLITE_ERROR"
  return file === TOP_COLUMN_CATCH_UP_MIGRATION_FILE && DUPLICATE_TOP_COLUMN_PATTERN.test(normalizedOutput)
}
