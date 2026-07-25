#!/usr/bin/env bash
# ============================================================================
# diff-to-test-prompt.sh — Fork-diff to LLM test-generation prompt
# ============================================================================
# Reads a git diff (stdin or file arg) and wraps it in a structured prompt
# for an LLM to generate tests. The diff IS the spec — every changed line is
# a behavioral claim that tests must verify.
#
# Usage:
#   git diff upstream/main...HEAD | .github/scripts/diff-to-test-prompt.sh
#   .github/scripts/diff-to-test-prompt.sh path/to/diff.txt
#
# Output: A self-contained prompt with workspace detection, test framework
#         hints, and suggested test-file locations.
#
# Workspace detection (by path prefix):
#   server/     → vitest (Nuxt env)     → server/test/unit/<module>/
#   cli/        → cargo test            → cli/tests/ or inline #[cfg(test)]
#   desktop/    → cargo test            → desktop/src-tauri/<crate>/tests/
#   libraries/  → cargo test            → inline #[cfg(test)]
#   other       → vitest (generic)      → <workspace>/test/
# ============================================================================

set -euo pipefail

# ---- Help ------------------------------------------------------------------
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  sed -n '3,19p' "$0"
  exit 0
fi

# ---- Read diff -------------------------------------------------------------
DIFF_CONTENT=""

if [[ $# -ge 1 && -f "$1" ]]; then
  DIFF_CONTENT="$(cat "$1")"
elif [[ ! -t 0 ]]; then
  DIFF_CONTENT="$(cat)"
else
  echo "ERROR: Provide a diff file or pipe diff to stdin." >&2
  echo "Usage: git diff upstream/main...HEAD | $0" >&2
  echo "       $0 path/to/diff.txt" >&2
  exit 1
fi

if [[ -z "$DIFF_CONTENT" ]]; then
  echo "ERROR: Empty diff input." >&2
  exit 1
fi

# ---- Workspace detection ---------------------------------------------------
detect_workspace() {
  local diff="$1"
  local workspaces=()

  if echo "$diff" | grep -q '^diff --git a/desktop/'; then
    workspaces+=("desktop/")
  fi
  if echo "$diff" | grep -q '^diff --git a/cli/'; then
    workspaces+=("cli/")
  fi
  if echo "$diff" | grep -q '^diff --git a/libraries/'; then
    workspaces+=("libraries/")
  fi
  if echo "$diff" | grep -q '^diff --git a/server/'; then
    workspaces+=("server/")
  fi
  if echo "$diff" | grep -q '^diff --git a/sites/'; then
    workspaces+=("sites/")
  fi
  if [[ ${#workspaces[@]} -eq 0 ]]; then
    echo "unknown"
  else
    printf '%s\n' "${workspaces[@]}" | sort -u | paste -sd ' ' -
  fi
}

detect_test_location() {
  local diff="$1"
  local file dir

  # Extract first changed file path, strip filename to get directory
  file="$(echo "$diff" | grep '^diff --git' | head -1 | sed 's/^diff --git a\/\(.*\) b\/.*/\1/')"
  dir="$(dirname "$file")"

  # Extract module name: the path segment after the workspace's source root.
  # server/server/api/v1/users.ts  → module=api
  # server/server/internal/auth/   → module=auth
  # cli/src/commands/upload.rs    → module=commands
  local module=""

  case "$dir" in
    server/server/api/v1*)
      module="api"
      echo "server/test/unit/${module}/"
      ;;
    server/server/internal/*)
      module="$(echo "$dir" | sed 's|server/server/internal/||; s|/.*||')"
      echo "server/test/unit/${module}/"
      ;;
    server/components/*)
      module="$(echo "$dir" | sed 's|server/components/||; s|/.*||')"
      [[ -n "$module" ]] && echo "server/test/unit/components/${module}/" || echo "server/test/unit/components/"
      ;;
    server/pages/*)
      echo "server/test/unit/pages/"
      ;;
    server/composables/*)
      echo "server/test/unit/"
      ;;
    server/server/*)
      echo "server/test/unit/misc/"
      ;;
    server/prisma/*)
      echo "server/test/integration/"
      ;;
    cli/src/*)
      module="$(echo "$dir" | sed 's|cli/src/||; s|/.*||')"
      [[ -n "$module" ]] && echo "cli/tests/${module}/ or inline #[cfg(test)]" || echo "cli/tests/ or inline #[cfg(test)]"
      ;;
    desktop/src-tauri/*)
      module="$(echo "$dir" | sed 's|desktop/src-tauri/||; s|/.*||')"
      echo "desktop/src-tauri/${module}/tests/"
      ;;
    libraries/*)
      echo "inline #[cfg(test)] mod tests { ... } in the source file"
      ;;
    sites/*)
      echo "test/ (co-located with source workspace)"
      ;;
    *)
      echo "test/ (co-located with source)"
      ;;
  esac
}

WORKSPACES="$(detect_workspace "$DIFF_CONTENT")"
TEST_LOC="$(detect_test_location "$DIFF_CONTENT")"

# ---- Test framework hints --------------------------------------------------
FRAMEWORK_HINTS=""
case "$WORKSPACES" in
  *server*)
    FRAMEWORK_HINTS="Framework: vitest with Nuxt test environment (environment: 'nuxt')
Utilities: server/test/setup.ts, server/test/utils/db.ts
Pattern: describe -> it -> expect. Mock HTTP via MSW (server/test/mocks/).
Convention: one test file per module, co-located in server/test/unit/ or server/test/integration/"
    ;;
  *cli*|*desktop*|*libraries*)
    FRAMEWORK_HINTS="Framework: cargo test (Rust)
Pattern: #[cfg(test)] mod tests { ... } with #[test] functions
Convention: integration tests in tests/ dir, unit tests inline"
    ;;
  *sites*)
    FRAMEWORK_HINTS="Framework: vitest
Pattern: describe -> it -> expect"
    ;;
  *)
    FRAMEWORK_HINTS="Framework: vitest (assumed)
Pattern: describe -> it -> expect"
    ;;
esac

# ---- Count stats -----------------------------------------------------------
FILE_COUNT="$(echo "$DIFF_CONTENT" | grep -c '^diff --git' || true)"
LINE_COUNT="$(echo "$DIFF_CONTENT" | grep -c '^[+-]' || true)"
ADDED="$(echo "$DIFF_CONTENT" | grep -c '^+' || true)"
REMOVED="$(echo "$DIFF_CONTENT" | grep -c '^-' || true)"

# ---- Build prompt ----------------------------------------------------------
cat <<PROMPT
You are an expert test engineer. The following git diff represents behavioral
claims made by code changes. Each changed line is a commitment about how the
system should behave. Generate tests that verify these claims.

If a test file already exists for the changed module, update it. Otherwise,
create a new test file.

Workspace(s): ${WORKSPACES}
Suggested test location: ${TEST_LOC}
${FRAMEWORK_HINTS}

Diff summary: ${FILE_COUNT} file(s), ${ADDED} additions, ${REMOVED} removals

For each changed function, export, API route, or component:
  1. Identify the behavioral claim (what should happen that didn't before)
  2. Write a test that passes when the claim holds and fails when it doesn't
  3. Cover: happy path, error cases, edge cases (empty input, null, boundary)
  4. Do NOT test unchanged code — only the behavioral delta

Write production-quality tests:
  - Descriptive test names (what + expected outcome)
  - Arrange-Act-Assert structure
  - No test interdependence
  - No mocked side effects that bypass the change's logic

Diff:
${DIFF_CONTENT}
PROMPT
