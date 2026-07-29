#!/usr/bin/env bash
# ==============================================================================
# sonarcloud-sync.sh — Sync SonarCloud findings to GitHub Issues
# ==============================================================================
#
# Queries SonarCloud for unresolved BLOCKER/CRITICAL/MAJOR issues, groups them
# by (severity, rule), and creates/updates GitHub issues to track them.
#
# Usage:
#   ./scripts/sonarcloud-sync.sh                  # Delta: new findings only
#   ./scripts/sonarcloud-sync.sh --backfill       # Full: all unresolved
#   ./scripts/sonarcloud-sync.sh --dry-run        # Preview, no changes
#   ./scripts/sonarcloud-sync.sh --backfill --dry-run
#
# Environment:
#   SONAR_TOKEN          Required. SonarCloud API token
#   GH_TOKEN             GitHub API token (falls back to GITHUB_TOKEN)
#   SONAR_PROJECT_KEY    SonarCloud project key (default: BillyOutlast_drop)
#   GITHUB_REPOSITORY    GitHub repo (default: BillyOutlast/drop)
# ==============================================================================

set -euo pipefail

# ---- Configuration -----------------------------------------------------------

SONAR_PROJECT_KEY="${SONAR_PROJECT_KEY:-BillyOutlast_drop}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-BillyOutlast/drop}"
GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

SONAR_API="https://sonarcloud.io/api/issues/search"
SEVERITIES="BLOCKER,CRITICAL,MAJOR"
PAGE_SIZE=500

# --- Flags --------------------------------------------------------------------

BACKFILL=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backfill) BACKFILL=true; shift ;;
    --dry-run)  DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# --- Validation ---------------------------------------------------------------

if [[ -z "${SONAR_TOKEN:-}" ]]; then
  echo "FATAL: SONAR_TOKEN is not set" >&2
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

log()   { echo "[$(date '+%H:%M:%S')] $*"; }
warn()  { echo "[WARN] $*" >&2; }
dry()   { $DRY_RUN && echo "[DRY-RUN] $*" || echo "$*"; }

# Build a stable group identifier: <SEVERITY>/<rule-short>
group_id() {
  local severity="$1" rule="$2"
  # Strip language prefix (e.g. "javascript:S8786" -> "S8786")
  local short_rule="${rule##*:}"
  echo "${severity}/${short_rule}"
}

# Build a GitHub issue title
issue_title() {
  local severity="$1" rule="$2" message="$3"
  local short_rule="${rule##*:}"
  # Truncate message to 60 chars for title
  local msg="${message:0:60}"
  echo "sonar: ${severity} — ${short_rule} ${msg}"
}

# Build catch-all issue title per severity
catchall_title() {
  local severity="$1"
  echo "sonar: ${severity} — Various unresolved issues"
}

# --- Step 1: Fetch unresolved issues from SonarCloud (with pagination) --------

log "Fetching unresolved issues from SonarCloud (project: ${SONAR_PROJECT_KEY})..."

SONAR_RESPONSE=$(curl -sS -f \
  -H "Authorization: Bearer ${SONAR_TOKEN}" \
  "${SONAR_API}?componentKeys=${SONAR_PROJECT_KEY}&resolved=false&severities=${SEVERITIES}&ps=${PAGE_SIZE}&p=1") || {
    warn "SonarCloud API request failed (exit code $?)"
    exit 1
  }

TOTAL=$(echo "$SONAR_RESPONSE" | jq -r '.total // 0')
TOTAL_PAGES=$(( (TOTAL + PAGE_SIZE - 1) / PAGE_SIZE ))
log "Found ${TOTAL} unresolved issues across ${TOTAL_PAGES} page(s) (BLOCKER/CRITICAL/MAJOR)"

if [[ "$TOTAL" -eq 0 ]]; then
  log "No unresolved issues — nothing to sync."
  exit 0
fi

if [[ "$TOTAL_PAGES" -gt 1 ]]; then
  ALL_ISSUES=$(echo "$SONAR_RESPONSE" | jq '.issues')
  PAGE=2
  while [[ "$PAGE" -le "$TOTAL_PAGES" ]]; do
    log "Fetching page ${PAGE}/${TOTAL_PAGES}..."
    PAGE_RESPONSE=$(curl -sS -f \
      -H "Authorization: Bearer ${SONAR_TOKEN}" \
      "${SONAR_API}?componentKeys=${SONAR_PROJECT_KEY}&resolved=false&severities=${SEVERITIES}&ps=${PAGE_SIZE}&p=${PAGE}") || {
        warn "SonarCloud API request failed on page ${PAGE} (exit code $?)"
        exit 1
      }
    ALL_ISSUES=$(echo "$ALL_ISSUES $(echo "$PAGE_RESPONSE" | jq '.issues')" | jq -s 'add')
    PAGE=$((PAGE + 1))
  done
  SONAR_RESPONSE=$(echo "$SONAR_RESPONSE" | jq --argjson issues "$ALL_ISSUES" '.issues = $issues')
fi

# --- Step 2: Group issues by (severity, rule) ---------------------------------

log "Grouping issues by (severity, rule)..."

# Build array of deduplicated groups
declare -A GROUP_KEYS  # group_id -> 1 (track which groups exist)

while IFS=$'\t' read -r rule severity message; do
  gid=$(group_id "$severity" "$rule")
  GROUP_KEYS["$gid"]=1
done < <(
  echo "$SONAR_RESPONSE" | jq -r '.issues[] | [.rule, .severity, .message] | @tsv'
)

# For each group, extract the full list of issues
declare -A GROUP_ISSUES   # group_id -> JSON array of issue objects
declare -A GROUP_SEVERITY # group_id -> severity
declare -A GROUP_RULE     # group_id -> rule
declare -A GROUP_MESSAGE  # group_id -> first issue message

for gid in "${!GROUP_KEYS[@]}"; do
  severity="${gid%%/*}"
  rule_short="${gid#*/}"

  # Reconstruct the full rule name (SonarCloud may prefix with language)
  ISSUES_JSON=$(echo "$SONAR_RESPONSE" | jq -c \
    --arg rule_match "${rule_short}" \
    --arg sev "${severity}" \
    '[.issues[] | select(.severity == $sev and (.rule | endswith($rule_match)))]')

  count=$(echo "$ISSUES_JSON" | jq 'length')
  GROUP_ISSUES["$gid"]="$ISSUES_JSON"
  GROUP_SEVERITY["$gid"]="$severity"

  # Extract full rule name from first issue
  full_rule=$(echo "$ISSUES_JSON" | jq -r '.[0].rule // ""')
  GROUP_RULE["$gid"]="$full_rule"

  msg=$(echo "$ISSUES_JSON" | jq -r '.[0].message // ""')
  GROUP_MESSAGE["$gid"]="$msg"

  log "  Group ${gid}: ${count} issues"
done

# --- Step 3: Separate large and small groups ----------------------------------

declare -A LARGE_GROUPS     # group_id -> 1 (count >= 3)
CATCHALL_CRITICAL_JSON="[]"
CATCHALL_MAJOR_JSON="[]"

for gid in "${!GROUP_KEYS[@]}"; do
  count=$(echo "${GROUP_ISSUES[$gid]}" | jq 'length')

  if [[ "$count" -ge 3 ]]; then
    LARGE_GROUPS["$gid"]=1
  fi
done

# Collect small-group issues (<3) into severity catch-all arrays

for gid in "${!GROUP_KEYS[@]}"; do
  count=$(echo "${GROUP_ISSUES[$gid]}" | jq 'length')
  severity="${gid%%/*}"

  if [[ "$count" -ge 3 ]]; then
    continue
  fi

  issues="${GROUP_ISSUES[$gid]}"
  if [[ "$severity" == "BLOCKER" || "$severity" == "CRITICAL" ]]; then
    CATCHALL_CRITICAL_JSON=$(echo "$CATCHALL_CRITICAL_JSON $issues" | jq -s 'add')
  elif [[ "$severity" == "MAJOR" ]]; then
    CATCHALL_MAJOR_JSON=$(echo "$CATCHALL_MAJOR_JSON $issues" | jq -s 'add')
  fi
done

log "Large groups (>=3 findings): ${#LARGE_GROUPS[@]}"
critical_catchall_count=$(echo "$CATCHALL_CRITICAL_JSON" | jq 'length')
major_catchall_count=$(echo "$CATCHALL_MAJOR_JSON" | jq 'length')
log "Catch-all critical: ${critical_catchall_count} issues"
log "Catch-all major: ${major_catchall_count} issues"

# --- Step 4: Fetch existing GitHub issues -------------------------------------

log "Fetching existing GitHub issues with 'sonarcloud' label..."
GH_ISSUES=$(gh issue list \
  --repo "$GITHUB_REPOSITORY" \
  --label sonarcloud \
  --state open \
  --json number,title,body \
  --limit 500)

EXISTING_ISSUES=$(echo "$GH_ISSUES" | jq -c '.' 2>/dev/null || echo "[]")
log "Found $(echo "$EXISTING_ISSUES" | jq 'length') existing open sonarcloud issues"

# Build a map: title -> issue number
declare -A TITLE_TO_NUMBER
while IFS=$'\t' read -r number title; do
  TITLE_TO_NUMBER["$title"]="$number"
done < <(
  echo "$EXISTING_ISSUES" | jq -r '.[] | [.number, .title] | @tsv'
)

# --- Step 5: Create issues for new groups (or update existing) -----------------

CREATED=0
CLOSED=0
SKIPPED=0

# Build issue bodies
build_issue_body() {
  local severity="$1" rule="$2" message="$3" issues_json="$4"
  local short_rule="${rule##*:}"
  local count
  count=$(echo "$issues_json" | jq 'length')

  # Collect all SonarCloud issue keys
  local keys
  keys=$(echo "$issues_json" | jq -r '[.[].key] | join(",")')

  local body=""
  body+="## SonarCloud Finding — ${short_rule}\n\n"
  body+="${message}\n\n"
  body+="sonarcloud-keys: ${keys}\n\n"
  body+="| File | Line |\n"
  body+="|------|------|\n"

  while IFS=$'\t' read -r component line; do
    # Strip project prefix from component: "BillyOutlast_drop:server/file.ts" -> "server/file.ts"
    local file="${component#*:}"
    body+="| \`${file}\` | ${line} |\n"
  done < <(
    echo "$issues_json" | jq -r '.[] | [.component, .line] | @tsv'
  )

  body+="\n### Fix\n\nFollow SonarCloud rule guidance for \`${short_rule}\`."
  printf '%b' "$body"
}

build_catchall_body() {
  local severity="$1" issues_json="$2" title="$3"
  local count
  count=$(echo "$issues_json" | jq 'length')

  local keys
  keys=$(echo "$issues_json" | jq -r '[.[].key] | join(",")')

  local body=""
  body+="## SonarCloud Finding — Various ${severity} Issues\n\n"
  body+="sonarcloud-keys: ${keys}\n\n"
  body+="| File | Line | Rule | Issue |\n"
  body+="|------|------|------|-------|\n"

  while IFS=$'\t' read -r component line rule message; do
    local file="${component#*:}"
    local short_rule="${rule##*:}"
    # Escape pipe characters in message
    local safe_msg="${message//|/\\|}"
    body+="| \`${file}\` | ${line} | ${short_rule} | ${safe_msg} |\n"
  done < <(
    echo "$issues_json" | jq -r '.[] | [.component, .line, .rule, .message] | @tsv'
  )

  body+="\n### Fix\n\nAddress each issue according to its rule guidance."
  printf '%b' "$body"
}

determine_labels() {
  local severity="$1"
  local labels="sonarcloud"

  case "$severity" in
    BLOCKER|CRITICAL) labels="${labels},critical" ;;
    MAJOR)            labels="${labels},major" ;;
    *)                labels="${labels},other" ;;
  esac

  echo "$labels"
}

# Process large groups (>= 3 findings each)
for gid in "${!LARGE_GROUPS[@]}"; do
  severity="${GROUP_SEVERITY[$gid]}"
  rule="${GROUP_RULE[$gid]}"
  message="${GROUP_MESSAGE[$gid]}"
  issues="${GROUP_ISSUES[$gid]}"
  title=$(issue_title "$severity" "$rule" "$message")
  labels=$(determine_labels "$severity")

  if [[ -n "${TITLE_TO_NUMBER[$title]:-}" ]]; then
    # Issue already exists — check if it needs updating
    existing_num="${TITLE_TO_NUMBER[$title]}"
    log "Issue #${existing_num} already exists for: ${title}"

    # In backfill mode, update the body
    if $BACKFILL; then
      body=$(build_issue_body "$severity" "$rule" "$message" "$issues")
      dry "gh issue edit ${existing_num} --body ..."
      if ! $DRY_RUN; then
        echo "$body" | gh issue edit "$existing_num" \
          --repo "$GITHUB_REPOSITORY" \
          --body-file - || warn "Failed to update issue #${existing_num}"
      fi
    else
      (( ++SKIPPED ))
    fi
  else
    # Create new issue
      body=$(build_issue_body "$severity" "$rule" "$message" "$issues")
      dry "Creating issue: ${title}"
    if ! $DRY_RUN; then
      created_url=$(echo "$body" | gh issue create \
        --repo "$GITHUB_REPOSITORY" \
        --title "$title" \
        --label "$labels" \
        --body-file - 2>/dev/null) || {
          warn "Failed to create issue: ${title}"
          continue
        }
      log "Created issue: ${title} → ${created_url}"
    fi
    (( ++CREATED ))
  fi
done

# Process catch-all groups
process_catchall() {
  local severity="$1" issues_json="$2" severity_label="$3"
  local count
  count=$(echo "$issues_json" | jq 'length')

  [[ "$count" -eq 0 ]] && return

  local title
  title=$(catchall_title "$severity")
  local labels="sonarcloud,${severity_label}"
  local body
  body=$(build_catchall_body "$severity" "$issues_json" "$title")

  if [[ -n "${TITLE_TO_NUMBER[$title]:-}" ]]; then
    existing_num="${TITLE_TO_NUMBER[$title]}"
    log "Catch-all issue #${existing_num} already exists for: ${title}"
    if $BACKFILL; then
      dry "gh issue edit ${existing_num} --body ..."
      if ! $DRY_RUN; then
        echo "$body" | gh issue edit "$existing_num" \
          --repo "$GITHUB_REPOSITORY" \
          --body-file - || warn "Failed to update catch-all issue #${existing_num}"
      fi
    else
      (( ++SKIPPED ))
    fi
  else
    dry "Creating issue: ${title}"
    if ! $DRY_RUN; then
      created_url=$(echo "$body" | gh issue create \
        --repo "$GITHUB_REPOSITORY" \
        --title "$title" \
        --label "$labels" \
        --body-file - 2>/dev/null) || {
          warn "Failed to create catch-all issue: ${title}"
          return
        }
      log "Created issue: ${title} → ${created_url}"
    fi
    (( ++CREATED ))
  fi
}

process_catchall "CRITICAL" "$CATCHALL_CRITICAL_JSON" "critical"
process_catchall "MAJOR" "$CATCHALL_MAJOR_JSON" "major"

# --- Step 6: Close issues whose findings are all resolved ----------------------

log "Checking for resolved findings to close..."

if [[ "$(echo "$EXISTING_ISSUES" | jq 'length')" -gt 0 ]]; then
  # Get all currently unresolved SonarCloud issue keys
  ALL_UNRESOLVED_KEYS_JSON=$(echo "$SONAR_RESPONSE" | jq '[.issues[].key]')

  while IFS= read -r issue; do
    issue_num=$(echo "$issue" | jq -r '.number')
    issue_title=$(echo "$issue" | jq -r '.title')
    issue_body=$(echo "$issue" | jq -r '.body // ""')

    # Extract SonarCloud keys from body
    if [[ "$issue_body" =~ sonarcloud-keys:\ ([A-Za-z0-9,._-]+) ]]; then
      keys="${BASH_REMATCH[1]}"
      # Remove whitespace, split by comma
      IFS=',' read -ra key_array <<< "$keys"

      all_resolved=true
      for key in "${key_array[@]}"; do
        key=$(echo "$key" | xargs)  # trim
        [[ -z "$key" ]] && continue
        # Check if this key still appears in unresolved results
        if echo "$ALL_UNRESOLVED_KEYS_JSON" | jq -e --arg k "$key" 'index($k)' >/dev/null; then
          all_resolved=false
          break
        fi
      done

      # Also skip catch-all issues — they need fuzzy matching, safer to let them persist
      if [[ "$issue_title" == *"Various"* ]]; then
        all_resolved=false
      fi

      if $all_resolved && [[ ${#key_array[@]} -gt 0 ]]; then
        dry "Closing issue #${issue_num}: All SonarCloud findings resolved"
        if ! $DRY_RUN; then
          if gh issue close "$issue_num" \
            --repo "$GITHUB_REPOSITORY" \
            --comment "All constituent SonarCloud findings have been resolved." 2>/dev/null; then
            log "Closed issue #${issue_num}: ${issue_title}"
            (( ++CLOSED ))
          else
            warn "Failed to close issue #${issue_num}"
          fi
        fi
      fi
    fi
  done < <(echo "$EXISTING_ISSUES" | jq -c '.[]')
fi

# --- Summary ------------------------------------------------------------------

echo ""
log "=== Sync Summary ==="
log "  Created:  ${CREATED}"
log "  Closed:   ${CLOSED}"
log "  Skipped:  ${SKIPPED}"
$DRY_RUN && log "  (dry-run — no changes were made)"

# Handle case where nothing was done
if [[ "$CREATED" -eq 0 && "$CLOSED" -eq 0 ]]; then
  log "  Everything up to date."
fi
