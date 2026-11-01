<!--
  Every PR in this repository targets cmspeedau/GameDepot. This fork must never open
  pull requests, issues, or package publishes against the upstream Drop OSS project.
  See CONTRIBUTING.md ("Fork boundary").
-->
## What and why

<!-- One logical change per PR. Explain the problem and why this approach. -->

## Target check

- [ ] Base repository is **`cmspeedau/GameDepot`** (branch `develop`), not `Drop-OSS/drop`
- [ ] Pushed to `origin` only; no upstream remote was used
- [ ] No upstream registry image or AUR package was published
- [ ] `scripts/check-fork-target.sh` passes locally

## Verification

<!-- What you ran, and what passed/failed. Distinguish pre-existing failures from new ones. -->

- [ ] Tests / typecheck / lint for the touched workspace
- [ ] Manual check of the affected behaviour

## Notes

<!-- Security-relevant changes, follow-ups, anything reviewers should know. -->
