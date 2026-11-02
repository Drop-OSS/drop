#!/usr/bin/env bash
# Deploy the depot server with a rollback trail: every build is tagged
# gamedepot/server:depot-test-<N>-<shortsha> before :latest moves, the new
# container gets a health gate, and a bad loop auto-reverts to the previous
# image id. `rollback` re-points :latest at any retained tag.
#
#   scripts/depot-deploy.sh              # build, tag, deploy, health-gate
#   scripts/depot-deploy.sh rollback 3   # or: rollback depot-test-3-abc1234
#
# Only meaningful for this fork's local iteration; upstream release
# automation tags properly.
set -euo pipefail
cd "$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --show-toplevel)"

KEEP=5
STATE_FILE=".depot-deploy-count"

wait_healthy() {
  local deadline=$((SECONDS + 120))
  while ((SECONDS < deadline)); do
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/ 2>/dev/null || true)
    if [[ "$code" =~ ^[23] ]]; then return 0; fi
    sleep 3
  done
  return 1
}

rollback_to() {
  local target="$1"
  echo "Rolling :latest back to ${target} ..."
  docker tag "$target" gamedepot/server:latest
  docker compose up -d gamedepot
  wait_healthy && echo "Rollback healthy." || echo "Rollback image also failing - investigate."
}

if [[ "${1:-}" == "rollback" ]]; then
  arg="${2:?usage: depot-deploy.sh rollback <N|shortsha|full-tag>}"
  if [[ "$arg" == depot-test-* ]]; then
    TARGET="gamedepot/server:$arg"
  else
    TARGET=$(docker images --format '{{.Repository}}:{{.Tag}}' gamedepot/server \
      | awk -F'depot-test-' -v want="$arg" '$0 ~ "depot-test-" {split($2,p,"-"); if ($2+0 == want || p[2] == want) print}' \
      | sort -V | tail -1)
    [[ -n "$TARGET" ]] || { echo "no retained tag matches '$arg'"; docker images gamedepot/server | head; exit 1; }
  fi
  rollback_to "$TARGET"
  exit 0
fi

N=$(( $(cat "$STATE_FILE" 2>/dev/null || echo 0) + 1 ))
SHA=$(git rev-parse --short HEAD)
TAG="gamedepot/server:depot-test-${N}-${SHA}"
PREV_IMAGE=$(docker inspect --format '{{.Image}}' gamedepot-server 2>/dev/null || true)

echo "Building ${TAG} ..."
docker compose build gamedepot
NEW_IMAGE=$(docker images --format '{{.ID}}' gamedepot/server:latest | head -1)
docker tag "$NEW_IMAGE" "$TAG"
echo "$N" > "$STATE_FILE"

docker compose up -d gamedepot
if ! wait_healthy; then
  echo "Server never became healthy on ${TAG}."
  if [[ -n "$PREV_IMAGE" ]]; then
    rollback_to "$PREV_IMAGE"
  else
    echo "No previous image recorded; leaving ${TAG} up for inspection."
  fi
  exit 1
fi

# Keep only the newest $KEEP test tags so bad loops stay diffable without
# hoarding layers.
docker images --format '{{.Tag}}' gamedepot/server \
  | grep '^depot-test-' | sort -V | head -n -"$KEEP" \
  | while read -r stale; do docker rmi "gamedepot/server:$stale" >/dev/null 2>&1 || true; done

echo "Deployed ${TAG} (healthy)."
