# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file contains **detailed** changelog information for each release.
For a quick overview of changes, see the [GitHub Releases](https://github.com/Bad3r/Rin/releases) page
which automatically generates release notes from commit messages.

## [Unreleased]

### Added
- Established a fork-owned Cloudflare deployment foundation with tracked root `wrangler.toml`, Cloudflare preflight/provisioning scripts, and deployment doc updates ([#15](https://github.com/Bad3r/Rin/pull/15)).
- Split tests into explicit `unit`/`integration`/`remote` tiers with local network guards and opt-in remote smoke wiring in CI/deploy paths ([#13](https://github.com/Bad3r/Rin/pull/13)).
- Migrated server tests to Vitest on Cloudflare Workers via `@cloudflare/vitest-pool-workers`, including Miniflare+D1 test wiring ([#31](https://github.com/Bad3r/Rin/pull/31)).
- Added manual deploy artifact source modes (`latest`, `version`, `url`) with release asset auto-resolution for workflow dispatches ([#18](https://github.com/Bad3r/Rin/pull/18)).
- Added Dependabot grouping plus scheduled/manual Nix flake lock update automation ([#19](https://github.com/Bad3r/Rin/pull/19)).
- Added Claude-based issue/PR triage and review workflows ([73b533b](https://github.com/Bad3r/Rin/commit/73b533b)).
- Added DevSkim security scanning workflow ([21a7ff4](https://github.com/Bad3r/Rin/commit/21a7ff4)).

### Changed
- Server routing is now Hono-only with retained behavior-contract coverage for router semantics, OAuth regressions, friend route mounting, and worker `/api/*` prefix handling.
- Coverage CI now enforces minimum router/core thresholds (`src/core/base.ts`, `src/core/router-factory.ts`, `src/core/router-hono.ts`) to guard post-cutover regressions.
- Tightened shared/client/server type boundaries and stabilized worker coverage cold starts for test reliability ([#32](https://github.com/Bad3r/Rin/pull/32)).
- Completed flake-first Nix/dev bootstrap and quality-gate rollout (`treefmt`, linting, pre-commit compatibility, repo formatting sync) ([#3](https://github.com/Bad3r/Rin/pull/3), [#6](https://github.com/Bad3r/Rin/pull/6), [#8](https://github.com/Bad3r/Rin/pull/8), [#11](https://github.com/Bad3r/Rin/pull/11)).
- Modernized core dependencies/tooling with Bun major updates, GitHub Actions refreshes, and Drizzle ORM/Kit upgrades ([#21](https://github.com/Bad3r/Rin/pull/21), [#26](https://github.com/Bad3r/Rin/pull/26), [#33](https://github.com/Bad3r/Rin/pull/33)).
- Updated project licensing to AGPL-3.0-or-later ([#4](https://github.com/Bad3r/Rin/pull/4)).
- Refreshed Nix/devenv lock inputs ([5991df2](https://github.com/Bad3r/Rin/commit/5991df2)).

### Deprecated

### Removed
- Removed the legacy router adapter and `ROUTER_IMPL` environment toggle from runtime/test configuration.

### Fixed
- Hardened search privacy and correctness by separating public/authenticated search cache keys, fixing search pagination propagation, and ensuring idempotent about-page bootstrap/seed behavior ([#37](https://github.com/Bad3r/Rin/pull/37)).
- Aligned server cache invalidation behavior and documented/covered partial-index assumptions for feed queries ([#37](https://github.com/Bad3r/Rin/pull/37)).
- Fixed moments editor corruption paths and restored alias-based `/about` authoring flow, including missing-about create CTA behavior for authenticated admins ([#36](https://github.com/Bad3r/Rin/pull/36)).
- Reduced pre-login auth bootstrap noise and fixed adjacent previous/next feed mapping regressions in client flows ([#36](https://github.com/Bad3r/Rin/pull/36)).
- Improved local migration catch-up detection for Wrangler duplicate-column output and muted known dev-only DevSkim noise from local banner logging ([#35](https://github.com/Bad3r/Rin/pull/35)).
- Normalized friend service route mounting to `/friend` so worker `/api/*` prefix stripping resolves to correct service paths ([#9](https://github.com/Bad3r/Rin/pull/9)).
- Corrected client/docs metadata links and UI accessibility/hook-compliance regressions after rebase sync ([#10](https://github.com/Bad3r/Rin/pull/10)).

### Security
- Added explicit least-privilege `GITHUB_TOKEN` workflow permissions and hardened Codecov upload handling to address workflow security findings ([#34](https://github.com/Bad3r/Rin/pull/34)).
- Hardened auth-token handling with secure-cookie usage, strict bearer-token precedence, and safer bootstrap logout behavior ([#36](https://github.com/Bad3r/Rin/pull/36)).

## [v0.2.0] - 2024-06-07

### Overview
This release focuses on simplifying deployment and configuration management by migrating environment variables from Cloudflare panel to GitHub Secrets/Variables.

### Added
- **SEO Caching**: Added `S3_CACHE_FOLDER` environment variable for SEO pre-rendering cache storage
- **GitHub-based Configuration**: Environment variables can now be configured directly through GitHub Secrets/Variables instead of Cloudflare panel
- **Automated Release Workflow**: Added automated release process with version validation and changelog generation
- **Version Consistency Checks**: CI now validates version consistency across all package.json files

### Changed
- **OAuth Variable Names**: Changed GitHub OAuth variable names to use `RIN_` prefix to comply with GitHub's naming restrictions:
  - `GITHUB_CLIENT_ID` → `RIN_GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET` → `RIN_GITHUB_CLIENT_SECRET`
- **Deployment Triggers**: Deployment now triggers only on version tags (e.g., `v0.2.0`) instead of branch pushes
- **Environment Management**: Migrated all environment variable management from Cloudflare panel to GitHub

### Migration Guide

#### For Existing Users

If you're upgrading from v0.1.0, follow these steps:

1. **Add new environment variables to GitHub Variables**:
   ```ini
   SEO_BASE_URL=<SEO base URL>
   SEO_CONTAINS_KEY=<SEO filter keyword, optional>
   S3_FOLDER=<S3 images folder, default: 'images/'>
   S3_CACHE_FOLDER=<S3 cache folder, default: 'cache/'>
   S3_BUCKET=<S3 bucket name>
   S3_REGION=<S3 region, use 'auto' for Cloudflare R2>
   S3_ENDPOINT=<S3 endpoint URL>
   S3_ACCESS_HOST=<S3 access URL>
   ```

2. **Add new secrets to GitHub Secrets**:
   ```ini
   S3_ACCESS_KEY_ID=<Your S3 Access Key ID>
   S3_SECRET_ACCESS_KEY=<Your S3 Secret Access Key>
   ```

3. **Update OAuth variables** (if using GitHub OAuth):
   - Rename `GITHUB_CLIENT_ID` to `RIN_GITHUB_CLIENT_ID`
   - Rename `GITHUB_CLIENT_SECRET` to `RIN_GITHUB_CLIENT_SECRET`

4. **Remove from Cloudflare** (optional):
   - These variables are now managed through GitHub and will be automatically deployed
   - You can remove them from Cloudflare Workers environment variables if they exist there

### Technical Details

#### Deployment Changes
- Previous: Deployment triggered on every push to `main`, `dev`, or `fix/*` branches
- Now: Deployment only triggers on version tags (e.g., `v0.2.0`)
- Benefit: More controlled releases, prevents accidental deployments

#### Configuration Changes
- Previous: Sensitive variables configured in Cloudflare panel
- Now: All variables configured in GitHub Secrets/Variables
- Benefit: Single source of truth, better version control integration

### Known Issues
- None reported

### Contributors
- Thanks to all contributors who helped with this release!

## [v0.1.0] - 2024-XX-XX

### Added
- 🎉 Initial release of Rin blog platform
- **Backend**: Cloudflare Workers with Elysia framework
- **Frontend**: React + Vite + Tailwind CSS hosted on Cloudflare Pages
- **Database**: Cloudflare D1 (SQLite-based edge database)
- **Storage**: Cloudflare R2 for image storage
- **Authentication**: GitHub OAuth integration
- **Editor**: Monaco Editor with Markdown support
- **Comments**: Comment system with Webhook notifications
- **RSS**: RSS feed generation
- **SEO**: SEO optimization with pre-rendering
- **i18n**: Multi-language support
- **Friend Links**: Automated health checks for friend links (every 20 minutes)

### Features
- Real-time local saving for article drafts
- Image upload and management
- Article tagging and categorization
- Responsive design
- Dark mode support
- Scheduled tasks via Cloudflare Cron Triggers

[Unreleased]: https://github.com/Bad3r/Rin/compare/v0.2.0...HEAD
[v0.2.0]: https://github.com/Bad3r/Rin/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/Bad3r/Rin/releases/tag/v0.1.0
