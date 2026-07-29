#!/usr/bin/env bash
set -euo pipefail

# Generate a dated coverage baseline markdown report from vitest coverage output.
# Usage: bash scripts/gen-coverage-report.sh [date]
# Output: docs/coverage-baseline-YYYY-MM-DD.md

DATE="${1:-$(date +%Y-%m-%d)}"
OUTPUT="docs/coverage-baseline-${DATE}.md"
TMPFILE=$(mktemp)

cleanup() { rm -f "$TMPFILE"; }
trap cleanup EXIT

echo "Running vitest coverage..."
pnpm --filter drop coverage 2>&1 | tee "$TMPFILE" > /dev/null || {
  echo "ERROR: coverage run failed" >&2
  exit 1
}

# vitest text reporter prints a table; the "All files" row is the summary.
SUMMARY=$(grep "All files" "$TMPFILE" | tail -1 || true)
if [[ -z "$SUMMARY" ]]; then
  echo "ERROR: could not find 'All files' row in coverage output" >&2
  exit 1
fi

STMTS=$(echo "$SUMMARY" | awk -F'|' '{gsub(/ /,"",$2); print $2}')
BRANCHES=$(echo "$SUMMARY" | awk -F'|' '{gsub(/ /,"",$3); print $3}')
FUNCS=$(echo "$SUMMARY" | awk -F'|' '{gsub(/ /,"",$4); print $4}')
LINES=$(echo "$SUMMARY" | awk -F'|' '{gsub(/ /,"",$5); print $5}')

DETAIL=$(grep -A20 "Coverage summary" "$TMPFILE" | grep -E "(Statements|Branches|Functions|Lines)" | sed 's/.*coverage: //' || true)

cat > "$OUTPUT" << EOF
# Coverage Baseline — ${DATE}

Measured on branch \`$(git rev-parse --abbrev-ref HEAD)\` at commit \`$(git rev-parse --short HEAD)\`.
Snapshot only — no gates, no thresholds.

## Summary (server — \`server/server/\` backend only)

| Metric | Value |
|---|---|
| Statements | ${STMTS}% |
| Branches | ${BRANCHES}% |
| Functions | ${FUNCS}% |
| Lines | ${LINES}% |

## Detail

\`\`\`
${DETAIL}
\`\`\`

## How to reproduce

\`\`\`bash
pnpm --filter drop coverage
\`\`\`

Output: \`server/coverage/lcov.info\`.
CI uploads to Codecov via \`codecov/codecov-action@v5\` with flag \`server\`.
EOF

echo "Coverage report written: $OUTPUT"
echo "Summary: Statements=${STMTS}% Branches=${BRANCHES}% Functions=${FUNCS}% Lines=${LINES}%"
