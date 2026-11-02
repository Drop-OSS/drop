#!/usr/bin/env bash
# Adapter fast-loop: rebuild only the compiled Nitro bundle into ./.dev-app and
# restart the server container against it. No image churn while parser/adapter
# bugs are still in play; when the flow actually succeeds, mint a real tagged
# image with scripts/depot-deploy.sh.
#
#   scripts/depot-dev.sh prepare    # one-off: builder image + seeded mount
#   scripts/depot-dev.sh build      # sync sources -> nitro build -> ./.dev-app
#   scripts/depot-dev.sh up         # run the server from the mounted bundle
#   scripts/depot-dev.sh restart    # pick up a freshly built bundle
#   scripts/depot-dev.sh down       # back onto the real :latest image
set -euo pipefail
cd "$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --show-toplevel)"

DEV="docker compose -f docker-compose.yml -f docker-compose.dev.yml"

case "${1:-}" in
  prepare)
    docker build --target build-system -t gamedepot/builder:dev .
    mkdir -p .dev-app
    if [[ -z "$(ls -A .dev-app 2>/dev/null)" ]]; then
      # Seed from the currently deployed bundle so the server boots instantly.
      docker run --rm -v "$PWD/.dev-app:/out" --entrypoint sh \
        gamedepot/server:latest -c 'cp -a /app/app/. /out/'
      echo "Seeded ./.dev-app from the live image."
    fi
    COMPOSE_PROFILES=dev $DEV up -d builder
    echo "Dev loop ready: depot-dev.sh build && depot-dev.sh up"
    ;;

  build)
    COMPOSE_PROFILES=dev $DEV exec -T builder sh -euc '
      CHANGED=0
      cmp -s /src/pnpm-lock.yaml /app/pnpm-lock.yaml || CHANGED=1
      # Sync working tree into the image workspace, keeping the container
      # node_modules volume (nested ones are symlinks into it).
      tar -C /src --exclude node_modules --exclude .git --exclude .output \
          --exclude .dev-app -cf - . | tar -C /app -xf -
      [ "$CHANGED" = 1 ] && pnpm install --frozen-lockfile
      cd /app/server && pnpm build
      find /out -mindepth 1 -maxdepth 1 -exec rm -rf {} +
      cp -a /app/server/.output/. /out/
      echo "bundle refreshed in ./.dev-app"
    '
    echo "Now: depot-dev.sh restart"
    ;;

  up)
    COMPOSE_PROFILES=dev $DEV up -d gamedepot
    ;;

  restart)
    COMPOSE_PROFILES=dev $DEV restart gamedepot
    ;;

  down)
    COMPOSE_PROFILES=dev $DEV stop builder 2>/dev/null || true
    docker compose up -d --force-recreate gamedepot
    ;;

  *)
    echo "usage: depot-dev.sh prepare|build|up|restart|down" >&2
    exit 1
    ;;
esac
