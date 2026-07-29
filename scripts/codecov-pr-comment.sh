#!/usr/bin/env bash
# ==============================================================================
# codecov-pr-comment.sh — Post Codecov coverage gaps as PR comment
# ==============================================================================
#
# Queries Codecov's compare API for per-file, per-line coverage on a PR,
# groups uncovered new lines by file, and posts a structured markdown comment.
#
# Usage:
#   ./scripts/codecov-pr-comment.sh
#
# Environment:
#   CODECOV_TOKEN        Required. Codecov API token (read-only scope)
#   GH_TOKEN             GitHub API token (falls back to GITHUB_TOKEN)
#   GITHUB_REPOSITORY    GitHub repo (default: BillyOutlast/drop)
#   GITHUB_PR_NUMBER     PR number (auto-detected from GitHub context)
#   MAX_FILES            Max files to report (default: 10)
# ==============================================================================

set -euo pipefail

# ---- Configuration -----------------------------------------------------------

GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-BillyOutlast/drop}"
GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
MAX_FILES="${MAX_FILES:-10}"

# Auto-detect PR number from GitHub context
if [[ -z "${GITHUB_PR_NUMBER:-}" ]]; then
  if [[ -n "${GITHUB_REF:-}" && "$GITHUB_REF" =~ ^refs/pull/([0-9]+)/merge$ ]]; then
    GITHUB_PR_NUMBER="${BASH_REMATCH[1]}"
  elif [[ -n "${GITHUB_EVENT_PULL_REQUEST_NUMBER:-}" ]]; then
    GITHUB_PR_NUMBER="${GITHUB_EVENT_PULL_REQUEST_NUMBER}"
  else
    echo "ERROR: GITHUB_PR_NUMBER not set and cannot auto-detect" >&2
    exit 1
  fi
fi

OWNER="${GITHUB_REPOSITORY%%/*}"
REPO="${GITHUB_REPOSITORY##*/}"

CODE_COV_API="https://api.codecov.io/api/v2/github/${OWNER}/${REPO}/compare"
CODE_COV_APP_URL="https://app.codecov.io/gh/${GITHUB_REPOSITORY}/pull/${GITHUB_PR_NUMBER}"

# --- Validation ---------------------------------------------------------------

if [[ -z "${CODECOV_TOKEN:-}" ]]; then
  echo "FATAL: CODECOV_TOKEN is not set" >&2
  echo "Generate a token at https://app.codecov.io/gh/${GITHUB_REPOSITORY}/settings/access" >&2
  exit 1
fi

if [[ -z "$GH_TOKEN" ]]; then
  echo "FATAL: GH_TOKEN or GITHUB_TOKEN is not set" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "FATAL: jq is required but not installed" >&2
  exit 1
fi

if ! command -v gh &>/dev/null; then
  echo "FATAL: gh (GitHub CLI) is required but not installed" >&2
  exit 1
fi

# --- Helpers ------------------------------------------------------------------

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# Compact consecutive line numbers into ranges: 1,2,3,5,7,8,9 → "1-3,5,7-9"
format_line_ranges() {
  local nums="$1"
  if [[ -z "$nums" ]]; then
    echo ""
    return
  fi

  # Sort and deduplicate
  local sorted
  sorted=$(echo "$nums" | tr ',' '\n' | sort -n | uniq | tr '\n' ',' | sed 's/,$//')
  IFS=',' read -ra arr <<< "$sorted"

  local result=""
  local start="${arr[0]}"
  local prev="${arr[0]}"

  for ((i=1; i < ${#arr[@]}; i++)); do
    local curr="${arr[i]}"
    if (( curr == prev + 1 )); then
      prev="$curr"
      continue
    fi
    if [[ "$start" == "$prev" ]]; then
      result="${result}${start},"
    else
      result="${result}${start}-${prev},"
    fi
    start="$curr"
    prev="$curr"
  done

  # Flush last range
  if [[ "$start" == "$prev" ]]; then
    result="${result}${start}"
  else
    result="${result}${start}-${prev}"
  fi

  echo "$result"
}

# --- Step 1: Fetch Codecov comparison data -----------------------------------

log "Fetching Codecov comparison for PR #${GITHUB_PR_NUMBER}..."

COMPARE_RESPONSE=$(curl -sS -f \
  -H "Authorization: Bearer ${CODECOV_TOKEN}" \
  "${CODE_COV_API}/?pullid=${GITHUB_PR_NUMBER}" 2>&1) || {
    echo "WARN: Codecov API request failed: ${COMPARE_RESPONSE}" >&2
    echo "WARN: Coverage may not be uploaded yet for this PR." >&2
    echo "WARN: Try waiting 2-3 minutes for Codecov to process the upload." >&2
    exit 0
  }

# Check for error response
if echo "$COMPARE_RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
  error_msg=$(echo "$COMPARE_RESPONSE" | jq -r '.error // "unknown error"')
  echo "WARN: Codecov API returned error: ${error_msg}" >&2
  exit 0
fi

# Check if comparison is ready
STATE=$(echo "$COMPARE_RESPONSE" | jq -r '.state // "unknown"')
if [[ "$STATE" == "pending" ]]; then
  echo "WARN: Codecov comparison is still processing. Try again later." >&2
  exit 0
fi

# --- Step 2: Parse files with uncovered new lines -----------------------------

log "Parsing coverage gaps..."

# Extract files that have diff and uncovered lines
FILE_DATA=$(echo "$COMPARE_RESPONSE" | jq -c '
  [.files[]? | select(.has_diff == true) |
  {
    file: (.name.head // .name.base // "unknown"),
    patch_coverage: (.totals.patch.coverage // 0),
    patch_hits: (.totals.patch.hits // 0),
    patch_misses: (.totals.patch.misses // 0),
    uncovered_lines: [
      .lines[]? |
      select(.added == true and (.coverage.head // 1) == 0) |
      (.number.head // .number.base // 0)
    ]
  } |
  select(.uncovered_lines | length > 0)]
' 2>/dev/null || echo "[]")

FILE_COUNT=$(echo "$FILE_DATA" | jq 'length')
log "Found ${FILE_COUNT} changed files with uncovered new lines"

# --- Step 3: Get aggregate patch totals ---------------------------------------

PATCH_TOTALS=$(echo "$COMPARE_RESPONSE" | jq '{
  coverage: (.totals.patch.coverage // 0),
  hits: (.totals.patch.hits // 0),
  misses: (.totals.patch.misses // 0),
  lines: (.totals.patch.lines // 0)
}')
PATCH_COV=$(echo "$PATCH_TOTALS" | jq -r '.coverage')
PATCH_HITS=$(echo "$PATCH_TOTALS" | jq -r '.hits')
PATCH_MISSES=$(echo "$PATCH_TOTALS" | jq -r '.misses')
PATCH_LINES=$(echo "$PATCH_TOTALS" | jq -r '.lines')

# --- Step 4: Build PR comment -------------------------------------------------

log "Building PR comment..."

COMMENT_BODY="## 📊 Codecov Coverage\n\n"

# Summary line
if [[ "$PATCH_LINES" -gt 0 ]]; then
  COMMENT_BODY+="**Patch coverage**: ${PATCH_COV}% (${PATCH_HITS} hits / ${PATCH_MISSES} misses / ${PATCH_LINES} lines)\n\n"
elif [[ "$FILE_COUNT" -eq 0 ]]; then
  COMMENT_BODY+="✅ All new lines in changed files are covered by tests.\n"
else
  COMMENT_BODY+="⚠️ Coverage data not yet available for this PR.\n"
fi

# File breakdown
if [[ "$FILE_COUNT" -gt 0 ]]; then
  COMMENT_BODY+="### Files Missing Coverage\n\n"
  COMMENT_BODY+="| File | Patch Cov | Misses | Uncovered Lines |\n"
  COMMENT_BODY+="|------|-----------|--------|-----------------|\n"

  # Sort by patch coverage (worst first), take top MAX_FILES
  count=0
  while IFS= read -r row; do
    if [[ $count -ge $MAX_FILES ]]; then
      break
    fi
    file=$(echo "$row" | jq -r '.file')
    cov=$(echo "$row" | jq -r '.patch_coverage')
    misses=$(echo "$row" | jq -r '.patch_misses')
    uncovered_raw=$(echo "$row" | jq -r '.uncovered_lines | join(",")')
    ranges=$(format_line_ranges "$uncovered_raw")

    COMMENT_BODY+="| \`$file\` | ${cov}% | ${misses} | ${ranges} |\n"
    count=$((count + 1))
  done < <(echo "$FILE_DATA" | jq -c 'sort_by(.patch_coverage) | .[]')

  if [[ "$FILE_COUNT" -gt "$MAX_FILES" ]]; then
    COMMENT_BODY+="\n*... and $((FILE_COUNT - MAX_FILES)) more file(s)*\n"
  fi
fi

COMMENT_BODY+="\n---\n\n"
COMMENT_BODY+="*[Codecov Dashboard](${CODE_COV_APP_URL})* | "
COMMENT_BODY+="*Generated by \`scripts/codecov-pr-comment.sh\`*\n"

# --- Step 5: Post comment -----------------------------------------------------

log "Posting comment to PR #${GITHUB_PR_NUMBER}..."

echo -e "$COMMENT_BODY" | gh pr comment "$GITHUB_PR_NUMBER" \
  --repo "$GITHUB_REPOSITORY" \
  --body-file - 2>/dev/null || {
    echo "ERROR: Failed to post comment to PR" >&2
    exit 1
  }

log "Comment posted successfully"
