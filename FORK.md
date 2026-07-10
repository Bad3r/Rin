# Fork Guide: Bad3r/Rin

Orientation for this fork of [openRin/Rin](https://github.com/openRin/Rin). Compiled 2026-07-10 from a
full audit of git history, all merged PRs, upstream drift, database schema state, and CI/deploy runs.
The companion decision report is [docs/fork-evaluation-2026-07.md](docs/fork-evaluation-2026-07.md).

## What Rin is

Rin is a Cloudflare-native blog platform: a single Worker backed by D1 (SQLite) through drizzle-orm,
R2/S3-compatible object storage for images, and Workers AI for article summaries. The client is a
React SPA built with Vite and served through Workers static assets. Content types are feeds (articles
with aliases, tags, drafts, pinning) and moments (short notes), plus comments, friend links with
scheduled health checks, RSS, and GitHub OAuth with JWT cookie auth.

## Fork identity

| Fact | Value |
|---|---|
| Origin | https://github.com/Bad3r/Rin |
| Upstream | https://github.com/openRin/Rin (about 2.8k stars, effectively one active maintainer) |
| Fork point | `aaddd1e`, 2026-02-16 (merge of upstream PR #432) |
| License | AGPL-3.0-or-later since PR #4 (upstream is MIT); elkjs (EPL-2.0, via mermaid) noted as a compliance follow-up |
| Divergence (2026-07-10) | 63 commits ahead, 98 commits behind `upstream/main` |
| Deployment | Worker `rin-server`, entry `server/src/_worker.ts`, SPA assets from `dist/client`, cron `*/20` (friend health, RSS) |
| Runtime state | Live: daily remote smoke tests green through 2026-07-10, last production deploy 2026-06-22 |

## Why the fork exists

Five goals, reconstructed from the PR record and the local rewrite plan:

1. **Fork sovereignty.** Own license (AGPL), own identity and links, own changelog, own deploy
   pipeline, and a fork-first conflict policy when taking upstream changes (PRs #4, #10, #15, #38, #48).
2. **Engineering quality baseline.** Reproducible Nix/devenv toolchain, treefmt/Biome/yamllint gates
   with git hooks, tiered tests running in the real Workers runtime, enforced coverage, least-privilege
   CI tokens, security scanners, and hand-validated dependency upgrades that supersede risky bot bumps
   (PRs #3, #6, #8, #13, #19, #31, #32, #33, #34).
3. **Staged rewrite to Astro + Hono + Preact** (rewrite-plan.md). Stage 1, the Hono server migration,
   was executed as a deliberate three-phase arc (PRs #9, #16, #39). Stages 2-5 never started.
4. **Product correctness fixes**, mostly auth and privacy: search cache separation, secure cookies,
   bearer-token precedence, moments editor corruption, the `/about` alias flow, feed pinning
   (PRs #35, #36, #37; migrations 0009-0011).
5. **AI-assisted maintenance.** Claude workflows for issue triage, deduplication, PR review, and
   labeling were the first fork change (PR #1), running alongside Dependabot, scheduled nix flake
   updates, DevSkim, and CodeQL.

## Decision (2026-07-10)

Option B from [docs/fork-evaluation-2026-07.md](docs/fork-evaluation-2026-07.md) is adopted:
maintenance mode plus one reconciliation sprint, with the Astro/Preact rewrite formally shelved.
The checkpoint stands: if the sprint has not landed by 2026-10-01, execute the switch-to-upstream
runbook (Option C) from the evaluation.

Two facts adjust how Option B is executed:

1. **The deployment is not yet in real use.** No content or users depend on the production D1, so
   data preservation does not constrain schema work. Migration de-collision therefore realigns to
   upstream numbering (adopt upstream 0009/0010 as-is, renumber the fork's 0009-0011 to follow,
   dropping any made redundant) instead of reserving fork-first numbers, and the production
   database can be rebuilt from the realigned sequence after a precautionary export.
2. **Upstream parity is the default.** The goal is to match upstream as closely as possible to
   keep maintenance cost low. Where fork and upstream behavior differ, prefer upstream's version
   unless the fork change is a deliberate security, privacy, or quality improvement. Fork changes
   that add real value (auth/privacy fixes, Workers-runtime test infrastructure) should over time
   be offered upstream as PRs to shrink the permanent delta.

## Work timeline

All substantive work happened 2026-02-16 to 2026-03-09. Bot PRs (Dependabot, flake updates) excluded.

| PR | Merged | Theme | Summary |
|---|---|---|---|
| #1 | 02-16 | automation | Claude workflows (triage, dedup, review, analysis) + `/label-issue` command |
| #4 | 02-16 | license | MIT to AGPL-3.0-or-later; elkjs EPL-2.0 flagged as follow-up |
| #3 | 02-16 | quality | treefmt + Biome + yamllint gates, git hooks via git-hooks.nix, CI format/lint jobs |
| #6 | 02-17 | nix | flake.nix entrypoint over devenv.nix, `nix develop` and `nix fmt` |
| #8 | 02-17 | format | one-time repo-wide formatting pass onto the new gates |
| #11 | 02-17 | devenv | bootstrap files ported from closed upstream PR openRin/Rin#433 |
| #12 | 02-17 | hygiene | ignore `*plan*.md` scratch and generated wrangler type outputs |
| #9 | 02-17 | router | dual router adapters (legacy/hono) behind `ROUTER_IMPL`, parity + routing regression tests |
| #10 | 02-17 | client | accessibility and hook-compliance fixes, metadata links moved to Bad3r/Rin |
| #13 | 02-17 | tests | unit/integration/remote tiers, outbound network blocked in local tiers |
| #16 | 02-17 | router | hono becomes the factory default, legacy kept as escape hatch |
| #15 | 02-17 | deploy | fork-owned deploy foundation. CONTENT NOT ON MAIN, see anomalies |
| #19 | 02-18 | automation | Dependabot config + scheduled nix flake.lock update PRs |
| #18 | 02-18 | deploy | manual deploys resolve artifacts by latest/version/url from Releases |
| #32 | 02-18 | types | JsonValue/IsoDateTimeString in @rin/api, cold-start warmup for coverage stability |
| #31 | 02-18 | tests | server tests moved into the Workers runtime (vitest-pool-workers, Miniflare, real D1); adds 0009.sql |
| #33 | 02-18 | deps | drizzle-orm 0.30 to 0.45, drizzle-kit 0.21 to 0.31, D1 adapter regression test |
| #34 | 02-18 | ci-security | least-privilege GITHUB_TOKEN everywhere, Codecov token uploads + junit + flags |
| #35 | 02-18 | fix | wrangler duplicate-column catch-up detection for feeds.top, DevSkim noise muted |
| #36 | 02-19 | fix | moments corruption, /about alias flow + create CTA, secure cookies, bearer precedence |
| #37 | 02-19 | fix | search cache split public vs authenticated (privacy), search pagination, about seed idempotent |
| #38 | 02-19 | docs | changelog synced with the PR run |
| #39 | 03-07 | router | legacy router and `ROUTER_IMPL` removed, hono-only, coverage gates enforced |
| #48 | 03-09 | intake | selective upstream intake (7 commits) + typegen/deploy hardening. CONTENT NOT ON MAIN, see anomalies |

Direct pushes to main: `73b533b` (retitled re-commit of PR #1), `2c28c1d` (README rewrite caution),
`5991df2` (flake pin bump before automation existed), `21a7ff4` (DevSkim workflow).

## Rewrite plan status

`rewrite-plan.md` (untracked scratch: `.gitignore` ignores `*plan*.md` by design, PR #12) defines five
stages toward an Astro + Hono + Preact stack. The rewrite was formally shelved by the 2026-07-10
decision; the table records where it stopped:

| Stage | Status |
|---|---|
| 1. Hono replaces the custom server router | Done, with caveats below |
| 2. Scaffold Astro app with @astrojs/preact | Not started (zero astro/preact references in the repo) |
| 3. Migrate one vertical slice end-to-end | Not started |
| 4. Migrate Wouter/React pages to Astro routes + islands | Not started (client remains React 19 + Vite 7 + wouter, 14 page components) |
| 5. Astro CF adapter + Hono worker, remove Vite SPA | Not started (deployment was instead unified as one Worker serving the Vite SPA via static assets) |

Stage 1 caveats: Hono is the only routing engine (`server/src/core/router-hono.ts`), the legacy router
and the `ROUTER_IMPL` toggle are deleted, and CI enforces coverage on the router core
(`scripts/check-server-router-coverage.ts`: 80% statements / 78% branches). But Hono runs behind a
compatibility adapter rather than idiomatically: handlers still receive the legacy Elysia-style
`Context` (`ctx.set.status`, `ctx.store`), middleware executes manually inside wrapped handlers, and
top-level dispatch in `server/src/server.ts` is a hand-rolled lazy service registry, not one mounted
Hono app. The recorded phase-1 TODO (move validation into Hono middleware/validators) is not done:
a bespoke validator in `packages/api/src/schema-validator.ts` covers 11 of about 56 route
registrations; the rest validate inline.

## Operational state (2026-07-10)

- CI on main is green. The daily `Remote Integration` smoke suite passes (latest run 2026-07-10),
  CodeQL and DevSkim scheduled runs pass.
- Last successful production deploy: 2026-06-22. Deploy flow: Build workflow artifact, then Deploy
  workflow (`workflow_run`, PR label, or manual dispatch with artifact source latest/version/url),
  executing `scripts/deploy-cf.ts` via `cli/bin/rin.ts`.
- Last human-authored change on main: `37d97a4`, 2026-03-07. Everything since is automation
  (Dependabot merges, nix flake.lock updates).
- Open PRs: 7, all bots (grouped major bumps plus a flake.lock update).
- No fork releases exist. Tags `v0.1.0`/`v0.2.0` on main are inherited upstream tags; the `v0.3.0*`
  tags in a local clone come from the upstream remote and are not ancestors of main.

## History anomalies (read before trusting git log or CHANGELOG)

`main` was force-push rewritten at least twice (resquash plus resets; `git reflog show main` shows
`fast-import` entries and `Reset to 37d97a4`). Consequences:

1. **PR #48 content is not on main** despite its merged status. The selective upstream intake
   (header layouts, feed card presentation, blurhash race fix, PV/UV hiding) plus `[ai]` typegen and
   deploy hardening (68 files) lives only at commit `1e22c3d`, still reachable in the object store:
   `git branch recover-intake 1e22c3d`. RESOLVED 2026-07-10: the payload was re-applied
   byte-faithfully on the reconciliation branch (the pre-merge tree is identical to `37d97a4`);
   branch `recover-intake` preserves the original commit.
2. **PR #15 content is not on main.** The deploy foundation (tracked root `wrangler.toml`,
   `cf:preflight`/`cf:bootstrap` provisioning, generated deploy config) was merged into side branch
   `chore/test-tiering-local-vs-remote` (commit `e3f0aba`) after that branch had already been
   squash-merged as PR #13. Root `wrangler.toml` therefore remains untracked local config on main.
   RESOLVED 2026-07-10: payload consciously dropped; the artifact-based deploy flow (PR #18, PR #48)
   is the working pipeline and generates wrangler config at deploy time. Recoverable at `e3f0aba`.
3. **CHANGELOG.md overstates main**: its Unreleased section lists the PR #15 deploy foundation, which
   is absent from the tree. RESOLVED 2026-07-10: entry removed.
4. Branch `upstream-intake/main-20260307` is a plain snapshot of upstream/main from 2026-03-08, not
   fork work.

## Upstream relationship

Current main contains zero upstream commits after the fork point. Upstream moved independently:

- Upstream performed its own Hono rewrite (upstream #438) and a 162-file cli/admin workspace reorg
  (upstream #455). The trees are structurally incompatible: syncing means intent-ports
  (re-implementing changes), never merges. PR #48 proved the approach and its cost.
- **Migration numbering collided.** Fork: `0009` (feeds.top), `0010` (About seed), `0011` (unique
  about index). Upstream: `0009` (ai_summary_status/error), `0010` (guest comments table rebuild).
  At the fork point upstream's Drizzle schema already contained `top` and `ai_summary` columns while
  its migration files stopped at `0008`; both sides then closed that schema/migration gap
  differently. RESOLVED 2026-07-10: the fork adopted upstream `0009`/`0010` verbatim and renumbered
  its own migrations to `0011`-`0013` (top, About seed, unique About index). Upstream still has no
  migration for `feeds.top` at all (created only by its `fixTopField` code path, nullable); the
  fork's `0011` is strictly stronger. Production D1 still sits at `migration_version` 11 with OLD
  fork semantics and must be rebuilt (see follow-ups).
- Significant upstream work the fork lacks: guest comments (upstream #515), the v0.3.0 stabilization
  wave (webhook fixes, client config bootstrap, public cache gating, scroll restore, storage
  streaming, alias cache invalidation), markdown editor toolbar, header layouts and feed card
  presentation (ported in PR #48, lost in the reset), hashtag sorting, June content-rendering fixes,
  AI summary status tracking.
- Upstream health: alive but bursty and single-maintainer (79% of commits by one author). v0.3.0
  released 2026-03-12 after a dense month of fixes; last push 2026-06-26; upstream merges
  AI-agent-authored PRs.

## Durable fork assets

Things of lasting value that only exist here:

- Workers-runtime test infrastructure: `@cloudflare/vitest-pool-workers` + Miniflare with real D1
  migrations applied in setup, isolated storage, outbound-network guard, unit/integration/remote
  tiers, junit + Codecov wiring, and hard coverage gates on the router core.
- The Hono routing layer with an explicit contract (`server/src/core/router-{contract,factory,hono}.ts`)
  and behavior regression tests (OAuth callback, friend mounting, `/api/*` prefix handling).
- Auth/privacy fixes: search cache separation, secure cookie + bearer precedence, hardened bootstrap,
  moments corruption fix, `/about` flow with idempotent seed (migrations 0009-0011).
- Reproducible toolchain: `flake.nix` + `devenv.nix` + `.treefmt.toml` + git hooks, with scheduled
  flake.lock update PRs.
- CI/CD depth: least-privilege tokens, DevSkim + CodeQL, deploy artifact provenance and a
  remote-integration deploy gate, preview cleanup, Claude maintenance workflows.
- `@rin/api` type hardening (branded `IsoDateTimeString`, JSON wire types, response types).
- Client modernization: React 19, local replacements for react-helmet and react-loading, flat ESLint.

## Resuming work

- Bootstrap: follow "New Worktree Bootstrap" in `AGENTS.md` (copy the generated pre-commit config and
  `.env.local` from the main checkout). Then `direnv allow` or `nix develop`; `devenv up` starts the
  dev process (`bun run dev`).
- Tests: in `server/`: `test:unit`, `test:integration`, `test:remote` (remote requires
  `ENABLE_REMOTE_INTEGRATION_TESTS=true` and `RIN_REMOTE_BASE_URL`). Client tests via
  `bun run --cwd client test`. See `docs/testing.md`.
- Key entry points: `server/src/_worker.ts` (fetch/scheduled), `server/src/server.ts` (lazy service
  registry and `/api` prefix handling), `server/src/core/router-hono.ts` (adapter),
  `server/src/services/*` (feature services), `client/src/page/*`, `packages/api` (shared
  types/schemas), `cli/bin/rin.ts` + `scripts/*` (dev, deploy, db, release).
- Docs: `docs/` is an rspress site (deployed by `docs.yml`); repo-level extras are
  `docs/testing.md` and `docs/error-handling.md`. `server/REFACTORING.md` is historical (pre-Hono).

## Outstanding follow-ups

The 2026-07-10 reconciliation sprint landed on `chore/option-b-reconciliation`: PR #48 payload
restored, PR #15 payload dropped (CHANGELOG corrected), migrations realigned to upstream numbering,
guest comments (upstream #515) plus the v0.3.0/June fix wave ported, docs and hygiene refreshed.
Remaining:

1. DONE 2026-07-10: production D1 realignment executed without a rebuild. Both `rin` and
   `rin-preview` were verified empty (0 rows in every content table, `migration_version` 11 with
   old fork semantics) and reset to `migration_version` 8, the last number both numbering schemes
   share. The next deploy applies the realigned 0009 (AI summary columns), 0010 (comments rebuild),
   0011 (top; skipped via the duplicate-column catch-up since the column exists), 0012 (About seed,
   NOT EXISTS guarded), 0013 (unique index, IF NOT EXISTS) and lands at version 13. Local dev DBs
   (`.wrangler` state) should simply be deleted and re-migrated.
2. Quarterly upstream intake candidates, rough value order: customizable webhook settings plus the
   webhook config resolver (upstream d56ed6b, 4393230, c83a091, 63693f8), markdown editor toolbar
   (3b16c2b), public cache gating inside CacheImpl (4921279), admin login access when the login
   entry is hidden (7ac58e6), feed edit lookup by numeric id and split cache keys (e0a46dc), client
   config bootstrap via the worker app shell (e53e8ef/f830332), AI summary status admin tooling
   (735b26b, 46b9d77).
3. Upstream PR candidates from the fork (per the decision's upstreaming goal): excluding
   guest_email from public comment lists, a real migration for feeds.top (upstream creates it only
   via the fixTopField code path, nullable, and misses it entirely when the info table pre-exists),
   and the Workers-runtime test infrastructure.
4. Review elkjs (EPL-2.0, via mermaid) for AGPL-3.0 compliance.
5. PR #66 review follow-up (medium): the blurhash canvas can stay blank when a mounted feed card's
   image src changes without a remount (`client/src/components/feed_card.tsx`,
   `client/src/components/markdown.tsx`); draw via a callback ref instead of an effect keyed on
   blurhash.
6. Steady state: merge bot PRs as they arrive; run the quarterly intake pass over
   `git log upstream/main`; checkpoint remains 2026-10-01 for the sprint being merged to main.
