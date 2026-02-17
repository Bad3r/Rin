# Server Unit Tests

Use this directory for server-side unit tests that should run without remote dependencies.

Rules:

- No outbound network calls.
- Use mocks/in-memory fixtures only.
- Keep deployed-environment checks under `server/tests/remote/`.
