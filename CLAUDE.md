# Drop

Self-hosted game distribution platform. Polyglot monorepo:

- `server/` — Nuxt 3 + Vue 3 app (TypeScript, Prisma, Tailwind, buf/protobuf)
- `backend/` — Go backend (go.work, module under `core/`)
- Rust crates: `cli/` (downpour), `torrential/`, `desktop/src-tauri/`, `libraries/{droplet,droplet_types,libarchive,native_model}`
- pnpm workspace: root + `server/`, `libraries/base/`, `sites/*`, `desktop/`

## Quality gates — what runs when

| Layer               | When       | What                                                                                  |
| ------------------- | ---------- | ------------------------------------------------------------------------------------- |
| Claude Code hooks   | every edit | format-on-edit (advisory)                                                             |
| lefthook pre-commit | commit     | prettier + eslint --fix on staged files, ast-grep scan, gitleaks                      |
| lefthook pre-push   | push       | server typecheck, clippy (changed crates), golangci-lint, knip report                 |
| GitHub Actions      | PR/push    | typecheck/lint/clippy + gitleaks history scan + cargo-audit ×7 crates + golangci-lint |
| GitHub Actions      | weekly     | semgrep deep scan → Code Scanning                                                     |

Hooks are early feedback; **CI is the authority**. Never disable a hook to make a
failure go away — read the output and fix it.

### Escape hatches

```sh
git commit --no-verify   # skip pre-commit once
git push --no-verify     # skip pre-push once
LEFTHOOK=0 git commit    # same via env var
```

## Commands

```sh
pnpm exec lefthook run pre-commit --all-files   # dry-run all pre-commit checks
pnpm exec lefthook run pre-push --all-files     # dry-run all pre-push checks
pnpm exec ast-grep scan [paths]                 # structural lint (sgconfig.yml)
pnpm exec ast-grep scan --json                  # machine-readable output
pnpm exec knip --reporter compact               # unused deps/exports/files report
cd backend && golangci-lint run ./core/...      # Go lint (.golangci.yml in backend/)
gitleaks protect --staged                       # secret scan staged changes
```

Native binaries NOT installable via pnpm:

- `gitleaks` — `brew install gitleaks`
- `cargo-audit` — `cargo install cargo-audit`
- `golangci-lint` — `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest`
  (must be built with the same Go version as `backend/go.work` or typechecking fails)

## Rollout status (flip these when clean)

- **knip**: report-only (`continue-on-error` in CI, `|| true` in hook). Baseline:
  117 unused files / 31 unused exports / 4 unused deps. Remove the escape hatches
  to enforce.
- **golangci-lint**: `--new-from-rev=origin/develop` (new issues only). Baseline:
  2 legacy issues in `core/database.go`. Remove flag when count is 0.
- **ast-grep** rules: `severity: warning`. Promote per-rule to `error` after cleanup.

## Conventions

- Rust: nightly toolchain (matches CI); clippy with `-D warnings`.
- Formatting: Prettier config at repo root (shared by all JS/TS/Vue packages).
- Go: format with gofmt/goimports; keep modules inside `backend/` consistent with `go.work`.
