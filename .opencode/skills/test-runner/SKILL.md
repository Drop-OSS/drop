---
name: test-runner
description: Run the correct test command for a Drop monorepo workspace.
---

# test-runner

Pick the right test command based on the workspace you touched. Read
the changed files first; pick the workspace; run that workspace's test
suite.

## Commands by workspace

| Changed path prefix       | Command (run from repo root)                              |
|---------------------------|----------------------------------------------------------|
| `server/test/e2e/**`      | `pnpm --filter drop test:e2e` (needs dev server running)   |
| `server/**`               | `pnpm --filter drop test`                                  |
| `cli/**`                  | `cd cli && cargo test --all-features --all`                |
| `desktop/src-tauri/**`    | `cd desktop/src-tauri && cargo test --workspace --no-fail-fast` |
| `libraries/droplet/**`    | `cd libraries/droplet && cargo test`                       |
| `libraries/native_model/**` | `cd libraries/native_model && cargo test`               |

## If only one file changed

Run only that file's tests for fast feedback:

- Vitest: `pnpm --filter drop test <path>` (e.g. `pnpm --filter drop test test/integration/prioritylist.test.ts`)
- Cargo: `cd <workspace> && cargo test -- <module>::<test_name>`

## On failure

1. Read the FIRST failing assertion — usually the root cause.
2. Check whether the failing test depends on env vars (`DATABASE_URL` for DB tests). If unset, the test may legitimately skip — that's not a failure.
3. Don't modify the test to make it pass. If the test is wrong, fix the assertion. If the code is wrong, fix the code.
4. Re-run only that test file/case to confirm the fix.

## Coverage (informational only)

```bash
pnpm --filter drop coverage
```

Outputs to `server/coverage/lcov.info`. No thresholds, no gates.
Baseline: 1.17% lines. See `docs/coverage-baseline-2026-07-24.md`.

## What NOT to do

- Don't run `cargo test` from the repo root — it walks into the server's package.json and runs the wrong thing.
- Don't run the full workspace suite for a single-file change. ~26 tests is fine; the full workspace is slow.
- Don't ignore "skipped" tests. They signal missing test infrastructure (e.g. no `DATABASE_URL`), not test bugs.
