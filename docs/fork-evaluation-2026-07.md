# Fork Evaluation: Continue, Restart, or Switch to Upstream

Date: 2026-07-10. Scope: full audit of fork history (24 authored PRs plus 4 direct commits), the
63-commit fork delta, the 98-commit upstream delta, CI and deploy run history, and database schema
state. Orientation, per-PR history, and the anomaly list live in [FORK.md](../FORK.md) at the repo
root.

> **Decision (2026-07-10): Option B adopted**, with two adjustments recorded in
> [FORK.md](../FORK.md): the deployment is not yet in real use, so schema work is not constrained
> by data preservation and migrations realign to upstream numbering rather than reserving
> fork-first numbers; and upstream parity is the default, with fork changes offered upstream when
> they add real value.

## Verdict

**Continue, scoped down (Option B): keep the fork as a hardened, self-maintaining deployment of
Rin, formally shelve the Astro/Preact rewrite, and run one reconciliation sprint (roughly 3-5
focused days). Set a hard checkpoint: if the sprint has not landed by 2026-10-01, execute the
switch-to-upstream runbook (Option C) instead.**

Ranking: B over C over A over D.

Reasoning: the deployed instance is healthy and self-maintaining (daily remote smoke tests green,
automated dependency and toolchain updates, last production deploy 2026-06-22), so continuing costs
little while preserving the fork's real value: its test/CI/tooling infrastructure and its auth and
privacy fixes. Switching today would trade those away and require one-time database surgery, in
exchange for upstream features that can instead be ported selectively. The original rewrite plan
(Astro + Preact) has not started after five months and should not drive the decision; dropping it
removes most of the fork's ambition cost while keeping everything that works. What the fork cannot
afford is drift without a decision: the migration numbering collision and upstream's structural
refactors make every month of delay more expensive.

## The numbers

| Metric | Value |
|---|---|
| Fork point | `aaddd1e`, 2026-02-16 |
| Fork delta | 63 commits, 236 files, +36.4k/-25.1k lines (a repo-wide format pass inflates line counts) |
| Upstream delta | 98 commits, including upstream's own Hono rewrite (#438) and a 162-file workspace reorg (#455) |
| Human activity on fork | 2026-02-16 to 2026-03-09 (22 days of work), idle since |
| Upstream activity | v0.3.0 released 2026-03-12; bursty (64 commits in March, 1 in April, 10 in May, 18 in June); last push 2026-06-26; 79% single-author |
| Fork CI | Green: daily remote smoke passing through 2026-07-10, CodeQL and DevSkim clean |
| Live deploy | Last success 2026-06-22; 7 open PRs, all bots |
| Schema state | Fork production D1 at `migration_version` 11 with fork semantics; collides with upstream 0009/0010 |

## Advantages of the fork (what would be lost by leaving)

1. **Test infrastructure upstream does not have.** Server tests run inside the real Workers runtime
   (`@cloudflare/vitest-pool-workers` + Miniflare) against a real D1 with migrations applied,
   outbound network blocked, in unit/integration/remote tiers, with coverage gates enforced in CI.
2. **Security and privacy fixes.** Search cache separation between public and authenticated results,
   secure cookies with bearer-token precedence, hardened auth bootstrap, moments editor corruption
   fix, idempotent `/about` provisioning, feed pinning. Verify upstream independently fixed any of
   these before discarding them.
3. **Reproducible toolchain.** Nix flake + devenv + treefmt/Biome/yamllint + git hooks; identical
   shells across machines; scheduled flake.lock update PRs.
4. **CI/CD depth.** Least-privilege tokens, DevSkim and CodeQL, Codecov flags and junit analytics,
   deploy pipeline with artifact provenance and a remote-integration deploy gate, preview cleanup,
   Claude triage/dedup/review automation, grouped Dependabot.
5. **Type hardening** in `@rin/api` (branded ISO datetime, JSON wire types) consumed by both apps.
6. **AGPL-3.0-or-later licensing**, if copyleft matters to the project's goals.
7. **Modernized client baseline**: React 19, no react-helmet/react-loading dependencies.

## Disadvantages of the fork (what it costs to stay)

1. **Feature drift.** Missing on main: guest comments, markdown editor toolbar, header layout and
   feed card presentation settings (ported once in PR #48, lost in a history rewrite), AI summary
   status tracking, the v0.3.0 stabilization wave, June content-rendering fixes.
2. **Every future sync is an intent-port.** Upstream's independent Hono rewrite and workspace reorg
   ended clean merges permanently. PR #48 measured the cost of one selective intake at roughly a
   day of careful work; structural divergence keeps raising it.
3. **The D1 migration collision** (fork 0009-0011 vs upstream 0009-0010, same numbers, different
   DDL) makes both syncing and leaving harder every time either side adds a migration.
4. **Bus factor 1 with demonstrated zero bandwidth for four months.** Automation curates
   dependencies; nobody curates the product.
5. **Misleading history.** Two merged PRs' content is silently absent from main (PR #15, PR #48)
   and CHANGELOG.md overstates what main contains. Navigating by GitHub history currently misleads.
6. **The stated purpose is mostly unstarted.** Stage 1 of 5 (Hono) is done, in compatibility-adapter
   form rather than idiomatic Hono; stages 2-5 (Astro/Preact) are untouched. Carrying an unstarted
   rewrite plan adds decision debt without value.

## Option A: continue the full program (sovereignty plus rewrite)

What it means: resume rewrite-plan.md stages 2-5 (Astro scaffold, vertical slice, page migration,
deployment switch) while also tracking upstream.

Cost: the client has 14 page components, an admin surface, a Monaco-based editor, and i18n; the
migration is a multi-week project even before the intent-port tax. Five months of history show the
bandwidth has not existed.

Verdict: not now. Option B does not preclude reviving this later; the `.treefmt.toml` even already
covers `*.astro` files.

## Option B (recommended): maintenance mode plus one reconciliation sprint

What it means: redefine the fork's purpose as "a hardened, self-maintaining Rin deployment with
selective feature intake", not "a rewrite". One sprint pays the accumulated debts:

1. Recover the PR #48 payload from `1e22c3d` (branch it, rebase onto main, re-merge). About half a
   day; restores header layouts, feed card presentation, blurhash fix, `[ai]` typegen hardening.
2. Decide the PR #15 payload at `e3f0aba`: recover the preflight/bootstrap deploy foundation or
   drop it and delete its CHANGELOG entry. About half a day.
3. De-collide migrations: reserve fork numbers (0012+) for ported upstream DDL, port upstream 0009
   (ai_summary_status/error) and 0010 (guest comments rebuild) under new numbers, and extend the
   catch-up logic in `scripts/migration-utils.ts`. About half a day.
4. Port guest comments (upstream #515) and the highest-value v0.3.0 fixes (webhooks, client config
   bootstrap, cache gating, alias cache invalidation). One to two days.
5. Doc hygiene: correct `AGENTS.md` (vitest, React 19, real script names), truth-up `CHANGELOG.md`,
   remove `worker-startup.cpuprofile`, update the README caution. About an hour.

Steady state afterward: merge bot PRs as they arrive and run a quarterly intake pass over
`git log upstream/main` for features worth porting.

Risk: the sprint never happens, which is the same bandwidth problem that stalled the rewrite.
That is what the checkpoint below is for.

## Option C: switch to upstream

What it means: archive the fork and run upstream (v0.3.0 or later) with the existing data.

One-time costs:

1. **Database surgery on production D1.** The fork database reports `migration_version` 11 with
   fork semantics; upstream expects its own 0009/0010. Runbook (verify on a local copy first):
   - Export a backup: `wrangler d1 export`.
   - Set `info.migration_version` to `8` (the last number both sides share).
   - Deploy upstream; its migration runner applies upstream 0009 (adds `ai_summary_status`,
     `ai_summary_error`) and 0010 (rebuilds `comments` with guest fields). Neither touches the
     fork's leftovers.
   - Leftover fork artifacts are harmless: `feeds.top` exists in upstream's schema, and the About
     row plus its unique index do not conflict with upstream DDL.
2. Redeploy from upstream with the existing Cloudflare resources, secrets, and OAuth app.
3. Accept the losses: everything in the Advantages list, most notably the search cache privacy fix
   and auth hardening, unless verification shows upstream fixed them independently.
4. Keep the fork repository archived for reference; nothing about the AGPL relicense constrains
   moving the deployment or the data.

Ongoing cost: near zero (upstream maintains). Risks: upstream is effectively one person, bursty,
merges AI-agent-authored PRs, and its v0.3.0 needed a month of stabilization fixes; expect
occasional breakage and a weaker security posture than the fork's automated gates.

## Option D: start over

Two flavors, both not recommended:

- **Re-fork upstream fresh and re-apply the fork's infrastructure.** Re-porting the
  vitest-pool-workers setup, the Nix stack, and the CI hardening onto upstream's reorganized tree
  (post #455) approaches the original build cost, and ends at the same place as Option B with less
  history.
- **Greenfield Astro + Hono + Preact blog.** A new project, not a fork strategy. Choose it only if
  building it is itself the goal; Rin's data model is small enough to export into anything later.

## Checkpoint

By **2026-10-01**, either the Option B sprint items 1-4 have merged, or execute Option C using the
runbook above. Record the decision in `FORK.md`. The worst outcome is prolonging the current state:
a live system whose git history misleads and whose schema debt compounds silently.
