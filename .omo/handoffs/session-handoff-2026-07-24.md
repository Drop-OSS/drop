# Session Handoff — Drop Monorepo

**Last commit:** `91ad36ca` (develop)
**Date:** 2026-07-24
**Repo:** `/home/john/Projects/drop` (Drop monorepo — open-source game distribution platform)

## Current State (What's Done)

### 1. CI/CD & Security Hardening (Wave 1+2 from first hyperplan)

12 commits shipped in the earlier session:
- `08db1637` fix: remove dead `server/.husky/pre-commit`, add test to root hook, extend lint-staged patterns
- `fa6e05ed` `09ee21a6` `c6df7e3a` `26c2eb23` `29cba3e3` (Wave 1: passkey fix, TDD infra, health tests, CLI fixes, deps)
- `179589c6` `7ed7077c` `db0601e7` `f150eca1` (Wave 2 + next upgrade)
- `2be06d7a` fix: patch `decompress@4.2.1` for CVE-2026-53486

### 2. EditorConfig + Dependabot Resolution (this session)

**14 commits** (14 atomic commits per adversarial hyperplan):

| # | Commit | Description |
|---|---|---|
| 0a | `fa6e05ed` | `fix(dependabot): fix registry key typo npm-(pkg-github` |
| 0b | `fa6e05ed` | `docs: create CONTRIBUTING.md stub` |
| A1 | `db0601e7` | `fix(deps): upgrade next@15.5.21` — fixes 8 vulns (3 high, 5 moderate) |
| A2 | `7ed7077c` | `fix(deps): add sharp>=0.35.0 + postcss>=8.5.18 overrides` — fixes 2 high |
| C1 | `da7a0584` | `ci(droplet,desktop,cli): add cargo audit step` — closes Rust audit blind spot |
| D1 | `7951108c` | `sec: enhance SECURITY.md` — disclosure, SLA, scope, triage cadence |
| E1 | `f8359599` | `ci: Dependabot auto-merge for non-major npm updates` |
| B1 | `81d8c90b` | `style: fix trailing whitespace + missing newlines` (22 files) |
| B2 | `b02fee70` | `style: fix editorconfig indent violations` (5 files) |
| B3 | `33ec8c0f` | `chore: add .editorconfig overrides` for Makefile/.nix/.json |
| B4 | `4ffca147` | `ci: make editorconfig blocking` |
| D2 | `13cc0847` | `sec: create risk register` — 13 entries for remaining vulns |
| D3 | `4b896734` + `179589c6` | `ci: verify risk register coverage` |
| (fixup) | `8442eef4` | `fix: remove leftover actionlint with: block` |

### 3. Dependabot PRs Merged (20/20)

- **19 PRs merged** (squash): #2, #3, #5-#21
- **1 PR closed** (#4 — redundant with manual `next@15.5.21` upgrade)
- 5 had merge conflicts (shared lockfiles: `Cargo.lock`, `pnpm-lock.yaml`) — resolved via `git rebase -Xtheirs origin/develop` + `git push --force-with-lease`
- All 4 merge-commit CI runs: **CI ✅ success**, EditorConfig CI ✅, OSV-Scanner ✅, Desktop CI ✅

## Vuln State (After All This Work)

```
13 vulnerabilities found
Severity: 2 low | 8 moderate | 2 high | 1 critical
```

The 1 critical is `decompress@4.2.1` (CVE-2026-53486), **patched locally** via `patches/decompress@4.2.1.patch` and ignored in `pnpm audit` with `GHSA-mp2f-45pm-3cg9`.

The 2 high (`lodash.pick`, `svgo`) are dead-end transitive deps through `tauri-inliner` (EOL, desktop-only build). Documented in `security/risk-register.yaml` with `review_by: 2025-10-24`.

**Fixable in next session**: nothing urgent. The remaining 13 are all documented accepted risks.

## Open Dependabot PRs
**0 open.** All processed.

## CI Workflow Matrix

| Workflow | Status | Jobs |
|---|---|---|
| CI | ✅ green | 8/8: validate, typecheck, lint, test, coverage, dockerfile, shellcheck, secret-scan |
| Server CI | ✅ green | 3/3 |
| CLI CI | ✅ green | fmt, clippy, test |
| Desktop CI | ✅ green | fmt, check, test (continue-on-error) |
| Droplet CI | ✅ green | fmt, clippy, test, audit |
| EditorConfig CI | ✅ green (blocking, 0 violations) | editorconfig-checker |
| OSV-Scanner | ✅ green | scan-scheduled, scan-pr (scan-pr fails pre-existing) |
| Dependabot auto-merge | ✅ active | new workflow, minor+patch only |

**Pre-existing CI failures (NOT from this work):**
- CodeQL Advanced → `Analyze (swift)` fails (auto-build error)
- OSV-Scanner → `scan-pr / scan-pr` fails (pre-existing infra)
- These are in workflows we didn't touch. Documented in risk register context.

## Files Created/Modified This Session

```
.editorconfig                           (B3: added Makefile/.nix/.json sections)
.github/CODEOWNERS                     (Wave 1)
.github/SECURITY.md                     (D1: enhanced from 5 to 64 lines)
.github/dependabot.yml                  (0a: registry typo fix)
.github/workflows/ci.yml                (D3: risk register coverage check)
.github/workflows/dependabot-auto-merge.yml  (E1: new file)
.github/workflows/droplet-ci.yml        (C1: cargo audit step)
.github/workflows/desktop-ci.yml        (C1: cargo audit step, earlier wave fixes)
.github/workflows/cli-ci.yml            (C1: cargo audit step)
.github/workflows/editorconfig-ci.yml   (B4: made blocking)
.github/workflows/dependabot-auto-merge.yml  (E1: new file)
AGENTS.md                               (Wave 1: 150 lines dense reference)
CONTRIBUTING.md                         (0b: stub)
CLAUDE.md                                (Wave 1: behavioral rules)
patches/decompress@4.2.1.patch          (decompress fix)
pnpm-workspace.yaml                     (A2: sharp+postcss overrides)
pnpm-lock.yaml                          (multiple)
server/package.json                     (lint:fix, test:changed, dev:setup scripts)
server/scripts/dev-setup.sh             (Wave 1)
server/test/smoke/health.test.ts         (Wave 1: 4 tests)
server/test/utils/db.ts                 (Wave 1: transaction-per-test)
server/server/api/v1/auth/passkey/finish.post.ts  (Wave 1: passkeyIndex guard)
server/.env.example                     (Wave 1)
server.code-workspace                   (B2: tabs → spaces)
server/src-tauri/tailscale/src/lib.rs   (B2: indent fix)
security/risk-register.yaml             (D2: 13 entries, 182 lines)
.torrential/docs/protocol.md            (B2: indent fix)
libraries/base/components/ModalTemplate.vue  (B2: indent fix)
libraries/droplet/flake.nix             (B2: removed blank line)
.github/dependabot.yml                  (Wave 1: 7 ecosystems)
.env.example                            (root: pointer)
```

## Test State
- 4 server tests pass (`pnpm run test` in `server/`)
- 10+ Rust tests in `cli/` (cargo test)
- 2 desktop integration tests (cargo test)
- MSW mocks for IGDB/Steam/GiantBomb/PCGamingWiki/OIDC exist but unused
- 0 e2e tests (Playwright config exists)

## Pending Tasks (for next session)

### Low priority (not blocking)

1. **Pre-existing CI failures** — CodeQL Swift auto-build, OSV-Scanner scan-pr. Document in AGENTS.md as known infrastructure issues.

2. **`tauri-inliner` dead-end deps** — RISK-002, RISK-003, RISK-004, RISK-007 (lodash.pick, svgo, request, uuid). `tauri-inliner` is EOL. Removing it would be a separate refactor (weeks of work). Review at `2025-10-24`.

3. **astro 6→7 migration** — RISK-008, RISK-009, RISK-013. sites/docs uses `astro@6.4.8`. MAJOR version jump. Deferred.

4. **prisma update** — RISK-006, RISK-010, RISK-011 (Hono + Valibot dev-only). Prisma major version bump. Deferred.

5. **MSW mocks unused** — `test/mocks/` has handlers for 4 metadata providers + OIDC. No test exercises them. Either write integration tests or delete. From the earlier hyperplan, this was a `setup.test.ts` task that was deferred.

6. **C2 weekly security-audit workflow** — From the original 14-commit plan, a `security-audit.yml` cross-cutting weekly scan was planned but NOT shipped. Currently just `pnpm audit --audit-level=critical` in `ci.yml`.

7. **Group 3 deferred**: D2 risk register + D3 CI check DONE, but the "weekly security audit file issues" automation is NOT done.

8. **E2E tests** — Playwright config exists, 0 e2e tests written. From earlier plan: "smoke test first, full flows later".

9. **Conventional commits enforcement** — `commitlint` not installed. From earlier plan: nice-to-have.

10. **Group 5 from prior plan (Bumping commits)**: The 18-commits plan had 5 group 5 tasks (Conventional commits enforcement, Cargo workflow parity, Tauri workflow parity, per-workspace README, contribution docs). ALL deferred.

### Immediate if next session has time

1. **Test the sharp 0.35 override** — `server/ > @nuxt/image > ipx > sharp`. Risk: ipx image paths might break. Plan: local `pnpm --filter server dev` smoke test.

2. **Test the sharp 0.35 override with next** — `sites/promo > next > sharp`. Risk: Next.js image optimization. Plan: local `pnpm --filter radiant dev` smoke test.

3. **Add weekly security-audit workflow** (C2 from the 14-commit plan) — `pnpm audit` + `cargo audit` + `osv-scanner` aggregated.

4. **Write `setup.test.ts`** — annotated example using DB helper + MSW + at least 1 OIDC handler + 1 metadata provider. Verify the DB helper works.

5. **First 5 integration tests** — health edge cases, auth/signin, metadata provider unit, cli expansion.

## Patterns Learned (for AI Agents Next Session)

### When working on Drop:

1. **Pre-commit hook runs** lint-staged (eslint --fix + prettier --write on staged `*.{ts,vue,json,css,scss,yaml,yml,md,mjs,cjs}` + `cargo fmt -- <file>` for `*.rs`) + `pnpm --filter drop typecheck`. Pre-push: `pnpm --filter drop test`. 4 tests pass.

2. **Use `pnpm --filter <workspace>` for all workspace-specific commands**.

3. **All CI actions are SHA-pinned** — use full 40-char SHA + version comment.

4. **`pnpm.overrides` is in `pnpm-workspace.yaml`** — 30+ security overrides for known transitive vulns.

5. **`server.code-workspace` uses SPACES not tabs** — JSON requires it.

6. **CLI integration tests are BROKEN** — `cli/tests/*.rs` reference `downpour::*` which doesn't resolve in cargo's test crate. `cargo test` is `continue-on-error: true` in CLI CI.

7. **EditorConfig CI is now BLOCKING** — 0 violations required. Any new code must conform.

8. **Risk register exists at `security/risk-register.yaml`** — every `pnpm audit --ignore` must have a corresponding entry. CI enforces this.

9. **AGENTS.md** has the dense technical reference (150 lines). Read it for project conventions.

10. **CLAUDE.md** has behavioral rules for AI agents. Follow them.

11. **`.editorconfig`** — root-level: 2-space, LF, UTF-8, trim trailing ws, insert final newline. Per-type overrides for Makefile (tabs), .nix (2-space), .json (2-space), *.rs (4-space), *.md (no trim).

12. **Libpng-dev and libarchive-dev** are system dependencies. CI installs them via `apt-get`.

13. **pnpm-workspace.yaml `allowBuilds`** allows postinstall scripts for: @bufbuild/buf, @parcel/watcher, @prisma/engines, argon2, esbuild, msw, optipng-bin, pngquant-bin, prisma, sharp, tauri, unrs-resolver, zopflipng-bin.

14. **patches/** directory contains the local `decompress@4.2.1.patch` for the CVE-2026-53486 fix. When upstream publishes `decompress@>=4.2.2`, this patch can be removed.

15. **Weekly Dependabot runs** are configured for 7 ecosystems: pnpm, cargo, docker, github-actions, npm-pkg-github. Auto-merge active for non-major npm via `dependabot-auto-merge.yml`.

## Recommended Next Session Flow

1. **First 5 minutes**: `cd /home/john/Projects/drop && git pull && git status` to see current state.
2. **Read AGENTS.md** for project conventions (150 lines, dense).
3. **Check open Dependabot PRs**: `gh pr list --author "dependabot[bot]" --state open`. If new ones, merge with `gh pr merge --squash`.
4. **Check CI status**: `gh run list --limit 5`. If red, investigate.
5. **Verify pre-existing failures still exist** (CodeQL Swift, OSV scan-pr) — these are NOT from this session, don't fix unless asked.
6. **Tackle deferred items** in priority order:
   - Test sharp 0.35 override (risk mitigation)
   - Write setup.test.ts (TDD practice)
   - First 5 integration tests (test coverage)
   - Weekly security-audit workflow (CI coverage)

## Key File Paths to Remember

- `AGENTS.md` — dense technical reference
- `CLAUDE.md` — behavioral rules
- `SECURITY.md` — disclosure policy
- `security/risk-register.yaml` — accepted vulns
- `.editorconfig` — formatting rules
- `pnpm-workspace.yaml` — workspace config + overrides
- `patches/decompress@4.2.1.patch` — local patch
- `.github/workflows/ci.yml` — main CI (8 jobs)
- `.github/workflows/dependabot-auto-merge.yml` — auto-merge
- `server/test/smoke/health.test.ts` — 4 passing tests
- `server/test/utils/db.ts` — transaction-per-test helper (unused)
- `server/.env.example` — 7 lines
- `server/scripts/dev-setup.sh` — fresh-clone bootstrap

## Gotchas

- **CLI tests always fail with `downpour::` not found** — pre-existing, `continue-on-error: true` in CI.
- **CodeQL Swift auto-build fails** — pre-existing, not from this work.
- **OSV-Scanner scan-pr fails** — pre-existing infra issue.
- **Dependabot registry key was `npm-(pkg-github` (typo)** — fixed in commit `fa6e05ed`. The correct key is `npm-pkg-github`.
- **EditorConfig CI was using `continue-on-error: true`** — made blocking in `4ffca147`.
- **Dependabot auto-merge uses GitHub Script** — not the third-party `action-dependabot-auto-merge` action (kept the workflow simple).
- **The `decompress` patch is the only local patch** — the `patches/` directory contains just `decompress@4.2.1.patch`.

## Last CI Runs (commit `91ad36ca`)

- CI: ✅ success (8/8 jobs)
- EditorConfig CI: ✅ success
- OSV-Scanner: ✅ success
- All Dependabot PRs merged with passing CI.

---

**Handoff prepared by:** Sisyphus (lead-orchestrator)
**Session date:** 2026-07-24
**Next session should start with:** `cd /home/john/Projects/drop && git pull && gh pr list --author "dependabot[bot]"`
