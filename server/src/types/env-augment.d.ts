export {}

declare global {
  interface Env {
    ROUTER_IMPL?: 'legacy' | 'hono'
    RIN_ALLOWED_REDIRECT_ORIGINS?: string
  }
}
