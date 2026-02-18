// Schema validator - Shared between client and server
// Mirrors the server's t object

export const t = {
  Object: (properties: Record<string, unknown>, options?: { additionalProperties?: boolean }) => ({
    type: 'object',
    properties,
    ...options,
  }),
  String: (options?: { optional?: boolean }) => ({ type: 'string', optional: options?.optional }),
  Number: (options?: { optional?: boolean }) => ({ type: 'number', optional: options?.optional }),
  Boolean: (options?: { optional?: boolean }) => ({ type: 'boolean', optional: options?.optional }),
  Integer: (options?: { optional?: boolean }) => ({ type: 'number', optional: options?.optional }),
  Date: (options?: { optional?: boolean }) => ({ type: 'string', format: 'date-time', optional: options?.optional }),
  Array: (items: unknown, options?: { optional?: boolean }) => ({ type: 'array', items, optional: options?.optional }),
  File: (options?: { optional?: boolean }) => ({ type: 'file', optional: options?.optional }),
  Optional: (schema: Record<string, unknown>) => ({ ...schema, optional: true }),
  Numeric: (options?: { optional?: boolean }) => ({ type: 'number', optional: options?.optional }),
}
