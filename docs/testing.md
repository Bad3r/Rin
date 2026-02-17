# Testing Strategy

Rin uses a three-tier test model:

## 1) Unit tests

- Scope: isolated module/service logic.
- Dependencies: mocked or in-memory only.
- Network: outbound network is blocked.

Run:

```bash
bun run test:unit
```

## 2) Integration tests (local)

- Scope: local multi-component behavior (router, middleware, services, in-memory DB).
- Dependencies: local only.
- Network: outbound network is blocked.

Run:

```bash
bun run test:integration
```

## 3) Remote integration tests

- Scope: deployed environment checks (Cloudflare/remote endpoints).
- Dependencies: remote deployment and secrets/config.
- Network: allowed.

Run (enabled + base URL required):

```bash
ENABLE_REMOTE_INTEGRATION_TESTS=true \
RIN_REMOTE_BASE_URL="https://your-deployment.example.com" \
bun run test:remote
```

## CI contract

- `test.yml` runs `test:ci` and `test:coverage:ci` only.
- Remote tests are isolated in their own workflow (`remote-integration.yml`) and deployment gating path.
- Remote tests can be disabled globally by keeping `ENABLE_REMOTE_INTEGRATION_TESTS` unset/false.
