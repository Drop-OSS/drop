# Drop Monorepo — Agent Instructions

Dense technical reference for AI coding agents. Keep under 150 lines. If a fact here is wrong, run `ls <path>` to verify before trusting.

## Workspace Map

| workspace                                                  | language | framework                      | entry point                   |
| ---------------------------------------------------------- | -------- | ------------------------------ | ----------------------------- |
| server/                                                    | TS       | Nuxt 3 + Nitro                 | nuxt.config.ts                |
| desktop/main/                                              | TS       | Nuxt 4                         | nuxt.config.ts                |
| desktop/src-tauri/                                         | Rust     | Tauri v2 (workspace, 7 crates) | client/, database/, games/, … |
| cli/                                                       | Rust     | clap (downpour)                | src/main.rs                   |
| sites/promo                                                | TS       | Next.js 15                     | next.config                   |
| sites/docs                                                 | TS       | Astro 6 + Starlight            | astro.config                  |
| libraries/base                                             | TS       | Nuxt layer                     | nuxt.config.ts                |
| libraries/droplet, droplet_types, libarchive, native_model | Rust     | —                              | Cargo.toml                    |
| torrential/                                                | Rust     | (experimental)                 | skip                          |

## Package Manager: ALWAYS pnpm, NEVER yarn or npm

- Root has `"packageManager": "pnpm@11.17.0"`. yarn 1.x refuses to run.
- `pnpm-workspace.yaml` declare:
  - `allowBuilds`: packages that may run install scripts (build-from-source fallbacks)
  - `onlyBuiltDependencies`: the **security-allowlisted** subset. Adding to this is a security decision.
  - `shamefullyHoist: true` (some plugins need it)
- `pnpm install` in CI requires system `libpng-dev` (apt) for pngquant-bin to compile.
- Root `package.json` has ONLY `"prepare": "husky"`. All scripts live in workspace package.jsons.

## Nuxt Server Double-Nesting (CRITICAL CONFUSION POINT)

`server/server/` is the Nitro server code, not the Nuxt app:

- `server/api/v1/*.ts` — API route handlers (file-based)
- `server/routes/auth/*.ts` — non-API routes (signin, signout, OIDC callback)
- `server/server/api/...` — actually? NO. The structure is: `server/` IS the Nuxt app root. Nitro code lives in `server/server/`. The dot is real. The double-nest is intentional, not a bug.

`server/components/`, `server/composables/`, `server/pages/`, `server/assets/` — Nuxt app frontend code.
`server/server/` — Nitro backend code. `server/server/internal/<domain>/` is the business logic layer.

## Custom ESLint Rules

- `drop/no-prisma-delete` — forbids `prisma.delete()`. Soft-delete is enforced. Use `update` with `deletedAt: new Date()` instead.
- `@intlify/vue-i18n/no-dynamic-keys` and `no-missing-keys` — error level. Hard-coded i18n strings in templates fail lint.

## Metadata Provider Pattern (server/server/internal/metadata/)

- `MetadataProvider` abstract class. Implementations: IGDB, Steam, GiantBomb, PCGamingWiki, Manual.
- `PriorityListIndexed<MetadataProvider>` ordered by `source`. Provider chain fallthrough: if IGDB returns nothing, Steam tries next.
- All external HTTP is mocked via MSW in tests (`server/test/mocks/metadata.ts`).
- Adding a new provider means: (1) implementing the class, (2) adding it to the chain, (3) adding its image CDN to CSP whitelist in `server/nuxt.config.ts`.

## Nitro Plugin Ordering

`server/server/plugins/` files are prefixed `01-` through `09-` for explicit init order. Adding a plugin means inserting at the right numeric prefix. Don't rename existing prefixes.

## Prisma Workflow

- Schema: `server/prisma/schema.prisma`. Migrations: `server/prisma/migrations/`.
- Generated client: `server/prisma/client/`. NEVER edit generated files.
- `server/postinstall`: runs `nuxt prepare && prisma generate && buf generate` — required after schema or `.proto` changes.
- `.env` sets `DATABASE_URL`. Tests need a test DB or transaction-per-test helper (see `server/test/utils/db.ts`).

## Build & Test Commands (per workspace)

```
# server/
pnpm --filter drop dev              # nuxt dev
pnpm --filter drop typecheck        # nuxt typecheck
pnpm --filter drop test             # vitest run
pnpm --filter drop test:e2e         # playwright
pnpm --filter drop format:check     # prettier --check .
pnpm --filter drop lint             # prettier + eslint
pnpm --filter drop lint:fix         # eslint --fix + prettier --write

# cli/ (Rust)
cargo test --all-features --all
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings

# desktop/src-tauri/ (Rust)
cargo check --all-features --all
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
```

## CI Workflow Map (`.github/workflows/`)

- `ci.yml` — main CI: typecheck, lint, test, format check (push to main/develop, all paths)
- `server-ci.yml` — server-only: typecheck, lint (push to develop on `server/**` + libs)
- `droplet-ci.yml` — Rust for `libraries/droplet/`, `droplet_types/`, `libarchive/`
- `libraries/native_model/.github/workflows/` — native_model Rust CI (independent)
- `cli-ci.yml` — Rust for `cli/` (added)
- `desktop-ci.yml` — Rust `cargo check` for `desktop/src-tauri/` (added)
- `pages.yml` — promo + docs site builds (push to develop)
- `client-release.yml` / `server-release.yml` — release workflows
- `codeql.yml`, `osv-scanner.yml` — security scanning
- `editorconfig-ci.yml` — setup-sherif .editorconfig enforcement (added)

## Pre-commit Hooks (ACTUAL BEHAVIOR)

- `.husky/pre-commit` (root, ACTIVE): runs `pnpm --filter drop lint-staged && pnpm --filter drop typecheck`
- `--filter drop` = `server/` (filter targets the `drop` package name; see `server/package.json`).
- lint-staged patterns: `*.{ts,vue,json,css,scss,yaml,yml,md,mjs,cjs}` → eslint --fix + prettier --write. `*.rs` → `cargo fmt -- <file>`.
- **Note:** Pre-commit does NOT run tests. Tests are slow + stateful; run `pnpm --filter drop test` manually before pushing.

## Common Gotchas

- **libpng-dev required in CI** (apt) for pngquant-bin native compile. Missing → ELIFECYCLE.
- **tailwindcss vite plugin causes infinite recursion in vitest** under `environment: "nuxt"`. Already fixed: `nuxt.config.ts` conditionally excludes the plugin when `process.env.VITEST === "true"`.
- **TypeScript `noUncheckedIndexedAccess`**: DEFERRED. Enabling this strict flag surfaces 30+ latent TS errors in `server/api/v1/{admin/import/massversion, auth/mfa/webauthn, auth/passkey}/`, `server/internal/{auth/totp, clients/event-handler, metadata/pcgamingwiki, system-data/index, utils/prioritylist}.ts`. Fix each site (`if (!arr[i]) return` or `const item = arr[i]; if (!item) return`). Tracked for follow-up; do not enable the flag until these are fixed.
- **Submodules**: none currently (no `.gitmodules`).
- **`.omo/`** directory: OpenCode run continuation state. Do not commit.
- **Nuxt 4 desktop** uses Nuxt 4 (not 3). Newer patterns may differ from server/.

## Agent Edit Protocol (matches CLAUDE.md)

After editing ANY file, run the appropriate formatter immediately. CI rejects unformatted code:

```
# server/.ts or .vue
pnpm --filter drop exec prettier --write <file>

# Rust
cargo fmt -- <file>

# Markdown, YAML, CSS, etc.
pnpm --filter drop exec prettier --write <file>
```

Before batch commits: `pnpm --filter drop lint:fix` from repo root.

## Test State (2026-07-24)

| Workspace                     | Tests                 | Notes                                            |
| ----------------------------- | --------------------- | ------------------------------------------------ |
| `server/`                     | 32 vitest + 1 skipped | `pnpm --filter drop test`                        |
| `cli/`                        | 10 cargo              | `cd cli && cargo test`                           |
| `desktop/src-tauri/database/` | 6 cargo               | `cargo test -p database`                         |
| `server/test/e2e/`            | 1 smoke               | `pnpm --filter drop test:e2e` (needs dev server) |

Coverage 1.17% lines / 2.09% funcs (server, no gates). See `docs/coverage-baseline-2026-07-24.md`.

Bugs caught during this sequence: `prioritylist.ts:34` (`a.priority == a.priority`); `database/Cargo.toml` missing `serde/derive` (53 errs); `cli/` binary-only, no `lib.rs`.

## Deferred Work Backlog (2026-07-24)

Captured at PR #22 (https://github.com/BillyOutlast/drop/pull/22) close-out. Repo issues disabled — document here instead of filing GitHub issues. **Re-evaluate when coverage >30% or as bandwidth allows.**

| Item                               | Trigger                  | Why deferred                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codecov test-results reporting     | Coverage >30%            | JUnit analytics produce zero signal at 32 tests. Use `codecov-action@v5` with `report_type: test_results` (NOT `codecov/test-results-action@v1` which is DEPRECATED).                                                                                                                                                                                          |
| `.codecov.yml` with `target: auto` | Coverage >30%            | At 1.17% baseline, ANY new uncovered code drops percentage and blocks every PR. Contradicts current "no gates" policy.                                                                                                                                                                                                                                         |
| gitleaks-action v2→v3 migration    | Pre-Sept 2026            | v2 uses Node 20; GitHub deprecates Node 20 default in Sept 2026. Also unlocks v3's native fork-PR base-SHA resolution.                                                                                                                                                                                                                                         |
| SonarCloud C rating fix            | Needs SonarCloud auth    | Cannot view findings via GitHub API. Likely test-only noise (90% of PR #22 is test code).                                                                                                                                                                                                                                                                      |
| `noUncheckedIndexedAccess` enable  | After latent-error fixup | 30+ latent TS errors in `server/api/v1/{admin/import/massversion, auth/mfa/webauthn, auth/passkey}/`, `server/internal/{auth/totp, clients/event-handler, metadata/pcgamingwiki, system-data/index, utils/prioritylist}.ts`. Each requires explicit `if (!arr[i]) return` guard.                                                                               |
| CLI integration tests refactor     | Post lib.rs unblock      | `cli/tests/*.rs` now compile (commit 35b63960), but real coverage of `commands/upload/` and `commands/connect/` flows needs fixture data setup.                                                                                                                                                                                                                |
| E2E user-flow data fixtures        | Post test DB infra       | 5 page-flow E2E tests were added then removed in PR #22: they return 500 in CI because the app needs DB + auth setup to render pages. The tailwindcss v4 vite plugin recursion is fixed (`E2E=true` guard in `server/nuxt.config.ts`), but the application itself can't render without services. Re-add page tests when test DB + auth fixtures are available. |
| commitlint                         | Multi-contributor        | Solo dev → zero value. Re-add when team >1.                                                                                                                                                                                                                                                                                                                    |

## Verifying Facts in This File

This file is a cache. Before trusting any fact, verify with a direct command:

- Workspace structure: `ls -la <workspace>/`
- Scripts: `cat <workspace>/package.json | jq .scripts`
- CI behavior: `cat .github/workflows/<file>.yml`
- pnpm config: `cat pnpm-workspace.yaml`
- Tsconfig strict mode: `cat server/tsconfig.json | grep strict`

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: `npx openskills read <skill-name>` (run in your shell)
  - For multiple: `npx openskills read skill-one,skill-two`
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>generate-test-cases</name>
<description>"Use when the user asks to analyze code for test coverage, list what test cases are needed, or review testing strategy — WITHOUT generating actual test code."</description>
<location>project</location>
</skill>

<skill>
<name>generate-tests</name>
<description>"Use when the user asks to generate, create, or write unit tests for code. Analyzes the target code, produces a structured test case list for review, then generates test code. Supports Java (JUnit 5, Mockito, AssertJ)."</description>
<location>project</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
