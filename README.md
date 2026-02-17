> [!CAUTION]
> This fork will include a major rewrite, it is not ready to be used by other users

![Cover](./docs/docs/public/rin-logo.png)

English | [简体中文](./README_zh_CN.md)


![GitHub commit activity](https://img.shields.io/github/commit-activity/w/Bad3r/Rin?style=for-the-badge)
![GitHub branch check runs](https://img.shields.io/github/check-runs/Bad3r/Rin/main?style=for-the-badge)
![GitHub top language](https://img.shields.io/github/languages/top/Bad3r/Rin?style=for-the-badge)
![GitHub License](https://img.shields.io/github/license/Bad3r/Rin?style=for-the-badge)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/Bad3r/Rin/deploy.yml?style=for-the-badge)

[![GitHub Issues](https://img.shields.io/github/issues/Bad3r/Rin?style=for-the-badge)](https://github.com/Bad3r/Rin/issues)
[![GitHub Discussions](https://img.shields.io/github/discussions/Bad3r/Rin?style=for-the-badge)](https://github.com/Bad3r/Rin/discussions)

## Introduction

Rin is a modern, serverless blog platform built entirely on Cloudflare's developer platform: Pages for hosting, Workers for serverless functions, D1 for SQLite database, and R2 for object storage. Deploy your personal blog with just a domain name pointed to Cloudflare—no server management required.

## Live Demo

https://xeu.life

## Features
- **Authentication & Management**: GitHub OAuth login. The first registered user becomes an administrator, while subsequent users join as regular members.
- **Content Creation**: Write and edit articles with a rich, intuitive editor.
- **Real-time Autosave**: Local drafts are saved automatically in real-time, with isolation between different articles.
- **Privacy Control**: Mark articles as "Visible only to me" for private drafts or personal notes, synchronized across devices.
- **Image Management**: Drag-and-drop or paste images to upload directly to S3-compatible storage (e.g., Cloudflare R2), with automatic link generation.
- **Custom Slugs**: Assign friendly URLs like `https://yourblog.com/about` using custom article aliases.
- **Unlisted Posts**: Option to keep articles out of the public homepage listing.
- **Blogroll**: Add links to friends' blogs. The backend automatically checks link availability every 20 minutes.
- **Comment System**: Reply to comments or moderate them with delete functionality.
- **Webhook Notifications**: Receive real-time alerts for new comments via configurable webhooks.
- **Featured Images**: Automatically detect the first image in an article and use it as the cover image in listings.
- **Tag Parsing**: Input tags like `#Blog #Cloudflare` and have them automatically parsed and displayed.
- **Type Safety**: End-to-end type safety with shared TypeScript types between client and server via `@rin/api` package.
- ...and more! Explore all features at https://xeu.life.

## Documentation

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Bad3r/Rin.git && cd Rin

# 2. Install dependencies
bun install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your own configuration

# 4. Start the development server
bun run dev
```

Visit http://localhost:5173 to start hacking!

### Nix / Flake Quick Start

If you use Nix, Rin now exposes a flake-first workflow:

```bash
# 1. Enter the reproducible shell and accept repo flake settings
nix develop --accept-flake-config -c true

# 2. Start local development
nix develop --accept-flake-config -c bun run dev

# 3. Run the full pre-commit suite
nix develop --accept-flake-config -c pre-commit run --all-files

# 4. Format the repository with treefmt
nix fmt
```

Notes:
- Hook definitions stay source-of-truth in `devenv.nix` and generate `.devenv/pre-commit-config.yaml`.
- `.pre-commit-config.yaml` at repo root is a compatibility entrypoint for default `pre-commit` behavior.
- If your host policy blocks IFD outside flake config acceptance, use `devenv shell --nix-option allow-import-from-derivation true`.

### Testing

Run the test suite to ensure everything works:

```bash
# Run deterministic local CI suite (unit + local integration)
bun run test:ci

# Run local unit tests only
bun run test:unit

# Run local integration tests only
bun run test:integration

# Run local coverage suite (no remote deployment dependency)
bun run test:coverage:ci

# Run remote deployment smoke tests (opt-in)
ENABLE_REMOTE_INTEGRATION_TESTS=true \
RIN_REMOTE_BASE_URL="https://your-deployment.example.com" \
bun run test:remote
```

Detailed test policy and tier definitions are documented in `docs/testing.md`.

### One-Command Deployment

Deploy both frontend and backend to Cloudflare with a single command:

```bash
# Deploy everything (frontend + backend)
bun run deploy

# Deploy only backend
bun run deploy:server

# Deploy only frontend
bun run deploy:client
```

**Required environment variables:**
- `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

**Optional environment variables:**
- `WORKER_NAME` - Backend worker name (default: `rin-server`)
- `PAGES_NAME` - Frontend pages name (default: `rin-client`)
- `DB_NAME` - D1 database name (default: `rin`)
- `R2_BUCKET_NAME` - R2 bucket name (auto-discovered if not set)

The deployment script will automatically:
- Create D1 database if it doesn't exist
- Auto-discover R2 bucket for image storage
- Deploy backend to Workers
- Build and deploy frontend to Pages
- Run database migrations

### GitHub Actions Workflows

The repository includes several automated workflows:

- **`ci.yml`** - Runs type checking and formatting validation on every push/PR
- **`test.yml`** - Runs deterministic local tests (unit + local integration) with coverage reporting
- **`build.yml`** - Builds the project and triggers deployment
- **`deploy.yml`** - Deploys to Cloudflare Pages and Workers
- **`remote-integration.yml`** - Runs deployed-environment smoke tests (nightly + manual, gated)

**Required secrets (Repository Settings → Secrets and variables → Actions):**
- `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token with Workers and Pages permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

**Optional configuration (Repository Settings → Secrets and variables → Variables):**
- `WORKER_NAME`, `PAGES_NAME`, `DB_NAME` - Resource names
- `NAME`, `DESCRIPTION`, `AVATAR` - Site configuration
- `R2_BUCKET_NAME` - Specific R2 bucket to use
- `ENABLE_REMOTE_INTEGRATION_TESTS` - Enable remote smoke workflow/deploy gate (`true`/`false`)
- `RIN_REMOTE_BASE_URL` - Default base URL for nightly remote integration workflow

**Optional secrets for remote smoke checks:**
- `RIN_REMOTE_AUTH_TOKEN` - Token used by remote integration tests when protected endpoints are checked

Full documentation is available in [`docs/docs`](./docs/docs).

## Community & Support

- Join GitHub Discussions for usage and deployment help: https://github.com/Bad3r/Rin/discussions.
- Follow release updates on GitHub: https://github.com/Bad3r/Rin/releases.
- Found a bug or have a feature request? Please open an issue on GitHub.

## Star History

<a href="https://star-history.com/#Bad3r/Rin&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Bad3r/Rin&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Bad3r/Rin&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Bad3r/Rin&type=Date" />
 </picture>
</a>

## Contributing

We welcome contributions of all kinds—code, documentation, design, and ideas. Please check out our [contributing guidelines](./CONTRIBUTING.md) and join us in building Rin together!

## License

```
Rin
Copyright (C) 2026  Bad3r

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
```
