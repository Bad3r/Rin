export {}

declare global {
  interface Env {
    ROUTER_IMPL?: 'legacy' | 'hono'
  }
}
