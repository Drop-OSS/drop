# Coverage Baseline — 2026-07-24

Measured after Tier 1 + partial Tier 2 commit sequence on branch
`chore/tdd-scaffolding-tier-2`. This is the starting point for future
coverage dashboarding — **no gates, no thresholds**, just a snapshot.

## Summary

| Metric | Value |
|---|---|
| Statements | 1.11% (58/5222) |
| Branches | 0.62% (15/2413) |
| Functions | 2.09% (18/858) |
| Lines | 1.17% (57/4854) |

## Highest-covered files

| File | % Lines | Covered by |
|---|---|---|
| `prioritylist.ts` | 35.48% | property-based test (Tier 1 #5) |
| `health.get.ts` | (high) | smoke test (pre-existing) |
| ... | ... | ... |

## Notes

- Server is the only workspace with coverage tooling configured.
- `cli/` has 10 cargo tests passing but no native coverage tooling
  (see tier-2/#13 plan to add `cargo-tarpaulin`).
- `desktop/src-tauri/database/` has 6 unit tests; coverage tool not yet
  configured for this workspace.
- The `.nuxt/` generated directory is excluded by vitest config, so
  coverage numbers reflect handwritten source only.

## How to reproduce

```bash
pnpm --filter drop coverage
```

Output lands in `server/coverage/lcov.info`. CI integration (Tier 2
#14) is the next step: upload to Codecov or similar, no thresholds.
