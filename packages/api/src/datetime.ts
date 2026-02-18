import type { IsoDateTimeString } from './types'

// Accepts RFC 3339 / ISO-8601 timestamps with explicit timezone.
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

function invalidDateError(fieldName: string, value: unknown): TypeError {
  return new TypeError(`Invalid ${fieldName}: expected an ISO 8601 date-time string, got "${String(value)}"`)
}

/**
 * Validate and mark a JSON date-time string as an API wire timestamp.
 */
export function asIsoDateTimeString(value: string, fieldName = 'date-time'): IsoDateTimeString {
  if (!ISO_DATE_TIME_PATTERN.test(value)) {
    throw invalidDateError(fieldName, value)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw invalidDateError(fieldName, value)
  }
  return value as IsoDateTimeString
}

/**
 * Convert a wire timestamp (or Date) into a validated Date instance.
 */
export function asDate(value: IsoDateTimeString | Date, fieldName = 'date-time'): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw invalidDateError(fieldName, value)
    }
    return new Date(value.getTime())
  }
  return new Date(asIsoDateTimeString(value, fieldName))
}

export function asOptionalDate(value: IsoDateTimeString | Date | undefined, fieldName = 'date-time'): Date | undefined {
  if (value === undefined) {
    return undefined
  }
  return asDate(value, fieldName)
}

export function toIsoDateTimeString(value: Date, fieldName = 'date-time'): IsoDateTimeString {
  return asDate(value, fieldName).toISOString() as IsoDateTimeString
}
