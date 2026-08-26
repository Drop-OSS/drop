#!/usr/bin/env bash
# Run `cargo clippy -D warnings` only over crates that contain changed .rs files.
# Called by lefthook pre-push. desktop/src-tauri is intentionally excluded:
# it needs Tauri system libraries that contributors on minimal setups won't have.
# CI covers it in droplet-ci.yml / torrential-ci.yml.
set -uo pipefail

# Resolve the repo root regardless of where the hook runs.
repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root" || exit 1

# :colon: curls are handled by set -e semantics below.
crates=(
  cli
  torrential
  desktop/src-tauri
  libraries/droplet
  libraries/droplet_types
  libraries/libarchive
  libraries/native_model
)

# Accumulate changed .rs files relative to repo root.
changed_rs="$(git diff --name-only HEAD -- '*.rs' 2>/dev/null; git diff --cached --name-only -- '*.rs' 2>/dev/null)"
# Falls back to previous-branch commit when @{push} isn't resolvable.
if [ -z "$changed_rs" ]; then
  upstream="$(git rev-parse --verify '@{push}' 2>/dev/null || git rev-parse --verify 'HEAD~1' 2>/dev/null || echo "")"
  if [ -n "$upstream" ]; then
    changed_rs="$(git diff --name-only "$upstream..HEAD" -- '*.rs' 2>/dev/null)"
  fi
fi

if [ -z "$changed_rs" ]; then
  echo "clippy-changed: no .rs changes; skipping"
  exit 0
fi

status=0
for dir in "${crates[@]}"; do
  if printf '%s\n' "$changed_rs" | grep -q "^${dir}/"; then
    echo "==> cargo clippy (${dir})"
    (cd "$dir" && cargo clippy --all-targets --all-features -- -D warnings) || status=1
  fi
done

exit "$status"