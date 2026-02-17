# Cloudflare Provisioning Scripts

These scripts establish fork-owned Cloudflare infrastructure for Rin.

## Commands

```bash
# Validate prerequisites and credentials
bun scripts/cloudflare/preflight.ts

# Create/check production + preview resources
bun scripts/cloudflare/bootstrap.ts --env all

# Only production
bun scripts/cloudflare/bootstrap.ts --env production

# Only preview
bun scripts/cloudflare/bootstrap.ts --env preview
```

## Required credentials

- `CLOUDFLARE_API_TOKEN` with permissions for Workers, D1, and R2.
- `CLOUDFLARE_ACCOUNT_ID` (or readable `/run/secrets/r2/account-id`).

For S3-compatible runtime uploads, these are also expected:

- `S3_ACCESS_KEY_ID` (or `/run/secrets/r2/access-key-id`)
- `S3_SECRET_ACCESS_KEY` (or `/run/secrets/r2/secret-access-key`)

## Environment naming contract

Defaults used when env vars are not supplied:

- Production: `rin-server`, `rin`, `rin-images`
- Preview: `rin-server-preview`, `rin-preview`, `rin-images-preview`

Override with env vars:

- Production: `WORKER_NAME`, `DB_NAME`, `R2_BUCKET_NAME`
- Preview: `PREVIEW_WORKER_NAME`, `PREVIEW_DB_NAME`, `PREVIEW_R2_BUCKET_NAME`

The bootstrap script prints suggested GitHub environment variables, including `D1_DATABASE_ID`.
