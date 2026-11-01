# AGENT.md

Guidance for AI coding agents (and humans working alongside them) contributing to GameDepot.

## Project Context

GameDepot is a self-hosted, DRM-free game distribution platform and an independent
hard fork of [Drop OSS](https://github.com/Drop-OSS/drop) (AGPL-3.0). Unlike upstream,
this fork explicitly welcomes AI-assisted engineering and rapid experimentation.

Read these first before making changes:

- `README.md` — project overview and feature/roadmap summary
- `ARCHITECTURE.md` — implemented internals, module boundaries, security model
- `ROADMAP.md` — phased plan; note what is **implemented** vs. **design target only**

## Monorepo Layout

- `server/` — Node.js/TypeScript backend (depot metadata, auth, storage, store ingestion)
- `app/` — Web UI (Svelte) — see "Web UI" section below
- `desktop/` — Tauri + Svelte/TypeScript desktop client
- `packages/` — shared TypeScript packages (`@gamedepot/*`), including shared contracts
  (DropletManifest, adapter-job, launch types)
- `cli/`, `libraries/`, `backend/`, `torrential/` — inherited from upstream
- `docs/`, `sites/` — documentation and static sites

Package manager is **pnpm** (see `pnpm-workspace.yaml`). Use pnpm workflows, not npm/yarn.

## Web UI — Keep Original

> **Important:** The web UI (`app/`) predates this fork. It is inherited from upstream
> Drop OSS and is to be kept **as close to its original state as possible**.
>
> - Do **not** refactor, restyle, restructure, or "modernize" the web UI.
> - Make only minimal, targeted fixes (e.g., a bug or a breakage caused by a backend
>   change), and keep even those changes surgical.
> - Prefer adapting backend code or contracts rather than changing the web UI.
> - If a task seems to require substantial web UI changes, stop and flag it for
>   human review instead of proceeding.

## Engineering Rules

1. **Understand before changing.** Trace the relevant code paths; read existing docs
   and tests. Don't guess at module boundaries.
2. **Minimal, targeted changes.** No opportunistic refactoring, no unrelated formatting
   churn, no deleting features or config without a clear reason.
3. **Follow existing conventions** of the workspace/package you touch.
4. **Adapter output is untrusted.** Anything coming from a store adapter (GOG, Epic) is
   validated before it touches the depot. Preserve the three-identity separation:
   provider build ID vs. release manifest ID vs. content-object digest.
5. **Security is not negotiable.** Never log credentials, tokens, or signed URLs.
   Keep path-traversal/symlink protections intact. External tools are version-pinned
   references, never bundled trust.
6. **Publish atomically.** Manifests and CAS objects are written once and validated;
   atomic rename only after verification. Don't weaken this.
7. **Don't fabricate status.** ROADMAP.md distinguishes implemented phases from design
   targets — keep it that way. Never document behavior that isn't implemented.

## Verification

- Run the relevant package's tests after meaningful changes (server packages use
  `node:test`; the Epic suite is hermetic with mocked OAuth).
- Prefer builds/lint/type-check of the touched workspace over full-repo runs when
  that's sufficient.
- Report honestly what was and wasn't verified; distinguish pre-existing failures
  from regressions you introduced.

## Commit & PR Hygiene

- Descriptive, conventional-style commit messages.
- One logical change per commit/PR; explain *why* in the description.
- Never include secrets, tokens, or personal data in commits, logs, or fixtures.
