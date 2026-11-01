#!/usr/bin/env bash
# Guard against this fork's work leaking into the upstream Drop OSS project:
# remotes, container/package publishes, and pull requests must stay inside the fork.
#
#   scripts/check-fork-target.sh
#
# Prints one line per check; exits non-zero if anything could leak upstream.
set -uo pipefail

PARENT_SLUG='Drop-OSS/drop'
status=0

fail() { printf '  FAIL  %s\n' "$*" >&2; status=1; }
ok()   { printf '  ok    %s\n' "$*"; }

origin_url="$(git remote get-url origin 2>/dev/null || echo '<no origin remote>')"
printf 'Fork guard: work must target %s, never %s\n' "$origin_url" "$PARENT_SLUG"

# 1. No configured remote may point at the parent repository.
remote_hits=0
while IFS=$'\t' read -r name url; do
  case "${url,,}" in
    *drop-oss/drop*)
      fail "remote '${name}' points at upstream: ${url}"
      remote_hits=$((remote_hits + 1))
      ;;
  esac
done < <(git remote -v | awk '{print $1 "\t" $2}' | sort -u)
[ "$remote_hits" -eq 0 ] && ok "no remote points at $PARENT_SLUG"

# 2. gh's default repository decides where `gh pr create` / `gh issue create` land.
#    This is a per-clone setting, so CI skips it (FORK_GUARD_CI=1) and asserts
#    the repository identity instead.
origin_slug="$(printf '%s' "$origin_url" | sed -E 's#^(git@|https://)github\.com[:/]##; s#\.git$##')"
if [ "${FORK_GUARD_CI:-0}" = "1" ]; then
  ok "clone-local checks skipped (FORK_GUARD_CI=1)"
elif command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  default_repo="$(gh repo set-default --view 2>/dev/null | head -n1 | tr -d '[:space:]')"
  case "$default_repo" in
    '' | [Xx]*)
      fail "gh has no default repository for this clone, so 'gh pr create' can target $PARENT_SLUG. Fix: gh repo set-default $origin_slug"
      ;;
    "$origin_slug")
      ok "gh default repository is $origin_slug"
      ;;
    *)
      fail "gh default repository is '$default_repo', not '$origin_slug'. Fix: gh repo set-default $origin_slug"
      ;;
  esac
else
  ok "gh not authenticated here: skipped default-repository check"
fi

# 3. Workflows must not publish to, or fetch releases from, upstream namespaces.
upstream_refs='ghcr\.io/(drop-oss|Drop-OSS)/|aur\.archlinux\.org/(drop-oss|Drop-OSS)|api\.github\.com/repos/Drop-OSS/drop|github\.com/Drop-OSS/drop/(releases|git)'
if hits="$(grep -rEn "$upstream_refs" .github/workflows 2>/dev/null)"; then
  fail "workflows reference upstream publish/fetch targets:"
  printf '%s\n' "$hits" | sed 's/^/        /' >&2
else
  ok "no workflow publishes to or fetches from $PARENT_SLUG"
fi

# 4. The checked-in pre-push hook must actually be active for this clone.
if [ "${FORK_GUARD_CI:-0}" = "1" ]; then
  ok "pre-push hook check skipped (FORK_GUARD_CI=1)"
elif [ "$(git config --get core.hooksPath || echo '')" = '.githooks' ]; then
  ok "pre-push hook is active (core.hooksPath=.githooks)"
else
  fail "pre-push hook is not active. Fix: git config core.hooksPath .githooks"
fi

if [ "$status" -ne 0 ]; then
  printf '\nFork guard failed. See CONTRIBUTING.md ("Fork boundary").\n' >&2
else
  printf '\nFork guard passed.\n'
fi
exit "$status"
