const TOP_COLUMN_CATCH_UP_MIGRATION_PREFIX = '0009'
const DUPLICATE_TOP_COLUMN_PATTERN = /duplicate column name\s*:?\s*top\b/

export function isKnownTopColumnCatchUpCase(file: string, output: string): boolean {
  const normalizedOutput = output.toLowerCase()
  return file.startsWith(TOP_COLUMN_CATCH_UP_MIGRATION_PREFIX) && DUPLICATE_TOP_COLUMN_PATTERN.test(normalizedOutput)
}
