# Drop — Agent Behavioral Rules

Cross-tool behavioral rules. Read by Claude Code, Cursor, Codex, OpenCode, and other AI coding agents. This file governs *behavior*; the dense technical reference is in `AGENTS.md`.

## After editing any file, format it immediately

Do not move on until formatting is applied. CI rejects unformatted code.

```bash
# TypeScript / Vue / Astro (server, sites, desktop/main, libraries/base)
pnpm --filter drop exec prettier --write <file>

# Rust (.rs files in cli/, desktop/src-tauri/, libraries/*)
cargo fmt -- <file>

# Markdown, YAML, JSON, CSS, SCSS
pnpm --filter drop exec prettier --write <file>
```

## Before batch commits

Run the full lint-fix and test suite:

```bash
# Format fix everything
pnpm --filter drop lint:fix

# Run tests (server workspace)
pnpm --filter drop test

# Verify nothing is unformatted
pnpm --filter drop format:check
```

The pre-commit hook runs lint-staged + `pnpm test` automatically. If pre-commit fails, fix the issue, then `git commit --amend --no-edit` (if no new files) or re-stage and commit.

## Do not commit

- `.env` files (use `.env.example` as template)
- `.nuxt/`, `.output/`, `dist/`, `coverage/` (build artifacts)
- `server/prisma/client/` (generated — regenerate with `pnpm --filter drop prisma generate`)
- `server/.nuxt/`, `server/.output/` (Nuxt build artifacts)
- `.omo/` (OpenCode internal state)
- Secrets, tokens, API keys — ever

## Package manager

ALWAYS pnpm. NEVER yarn or npm. The project has `packageManager: pnpm@11.17.0` enforced. yarn 1.x will refuse to run.

## Run commands from workspace directory

For `cd server && pnpm test`-style commands, either:
- `pnpm --filter drop <script>` from root
- `cd server && pnpm <script>` from inside the workspace

Do NOT run `pnpm test` from root (root has no `test` script).

## Verify before claiming completion

Do not say "done" or "fixed" without tool evidence from this session:
- Tests: `pnpm --filter drop test` output showing pass
- Lint: `pnpm --filter drop lint` output showing pass
- Typecheck: `pnpm --filter drop typecheck` output showing pass
- CI: `gh run view <run-id> --json conclusion` returning `success`

## When uncertain

1. Read `AGENTS.md` (technical reference)
2. `ls <path>` to verify directory structure
3. `cat <file>` to verify config
4. If still unclear, ask the user before proceeding

## Edit loops

If a file is repeatedly auto-formatted by linters, the file has a deeper issue. Stop and investigate — do not loop.

## Do not touch

- `server/.husky/pre-commit` (dead code, will be deleted)
- Generated Prisma client (`server/prisma/client/`)
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`) — only update via `pnpm install` / `cargo update`
