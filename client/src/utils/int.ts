export function tryInt(defaultValue: number, ...args: (string | number | undefined | null)[]): number {
  for (const v of args) {
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      const n = parseInt(v, 10)
      if (!Number.isNaN(n)) return n
    }
  }
  return defaultValue
}
