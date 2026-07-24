# Contributing to Drop

Thanks for your interest in contributing. This is a stub — full contributor guide is being developed.

## Quick start

- **Local setup**: see [`AGENTS.md`](./AGENTS.md) for the dense technical reference
- **Reporting vulnerabilities**: see [`SECURITY.md`](./SECURITY.md) for the disclosure policy

## Pull requests

- PRs target `develop`
- Pre-commit hook runs `lint-staged` (eslint --fix + prettier --write on staged files)
- Pre-push hook runs `pnpm --filter drop test`
- CI must pass: typecheck, lint, test, coverage, actionlint, hadolint, shellcheck, gitleaks, dependency-review

## Commit messages

- Conventional Commits format preferred
- Subject line ≤50 chars
- Reference issue numbers where applicable

## Reporting issues

- Bug reports: GitHub Issues with the `bug` label
- Feature requests: GitHub Issues with the `enhancement` label
- Security: **do not** file a public issue. Email security@droposs.org instead.
