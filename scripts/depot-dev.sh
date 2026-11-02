#!/usr/bin/env bash
# Adapter fast-loop: rebuild only the compiled Nitro bundle into ./.dev-app and
# restart the server container against it. No image churn while parser/adapter
# bugs are still in play; when the flow actually succeeds, mint a real tagged
# image with scripts/depot-deploy.sh.
#
#   scripts/depot-dev.sh prepare          # one-off: builder image + seeded bundle
#   scripts/depot-dev.sh migrate-bundle   # one-time: flat .dev-app -> blue-green
#   scripts/depot-dev.sh build            # sync sources -> build -> new release
#   scripts/depot-dev.sh clean            # drop builder Vite/Nuxt caches
#   scripts/depot-dev.sh up               # (re)create the server on `current`
#   scripts/depot-dev.sh restart          # apply `current` to the running stack
#   scripts/depot-dev.sh rollback         # point `current` at the previous release
#   scripts/depot-dev.sh down             # back onto the real :latest image
#
# Blue-green publishing: `build` writes the bundle to .dev-app/releases/<stamp>
# and atomically flips the .dev-app/current symlink; it never overwrites files
# under a running server, so a build is safe while acquisitions run. The new
# bundle applies on the next `restart`/`up`; `rollback` flips the symlink back
# (keeping the newest three releases). The build itself is still the heavy
# part: schedule it against the machine, not the server.
#
# Two builds overlapping in the builder (e.g. a `pnpm typecheck` still writing
# .nuxt when a build starts, or a SIGKILLed build) poison the Vite/Nuxt caches
# there. Every bundle from poisoned caches serves an unstyled, subtly broken
# client with ZERO console errors - the HTML and asset hashes all check out, so
# only the rendered page shows it. If the web UI goes naked after a rebuild:
# `depot-dev.sh clean && depot-dev.sh build`. Never run two builds/typechecks
# in the builder at once.
set -euo pipefail
cd "$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --show-toplevel)"

DEV="docker compose -f docker-compose.yml -f docker-compose.dev.yml"

case "${1:-}" in
  prepare)
    docker build --target build-system -t gamedepot/builder:dev .
    mkdir -p .dev-app
    if [[ ! -e .dev-app/current ]]; then
      # Seed from the currently deployed bundle so the server boots instantly.
      mkdir -p .dev-app/releases/seed
      docker run --rm -v "$PWD/.dev-app:/out" --entrypoint sh \
        gamedepot/server:latest -c 'cp -a /app/app/. /out/releases/seed/'
      ln -sfn releases/seed .dev-app/current
      echo "Seeded ./.dev-app/releases/seed from the live image."
    fi
    COMPOSE_PROFILES=dev $DEV up -d builder
    echo "Dev loop ready: depot-dev.sh build && depot-dev.sh up"
    ;;

  migrate-bundle)
    # One-time conversion of a legacy flat .dev-app (bundle files directly in
    # it) to the releases/ + current layout. Run it while the server is down
    # or as the recreate happens - moving the bundle dirs out from under a
    # running server breaks its lazy imports.
    if [[ ! -e .dev-app/server || -e .dev-app/current ]]; then
      echo ".dev-app is already blue-green (or empty) - nothing to do."
      exit 0
    fi
    mkdir -p .dev-app/releases/legacy
    find .dev-app -mindepth 1 -maxdepth 1 ! -name releases -exec mv {} .dev-app/releases/legacy/ ';'
    ln -sfn releases/legacy .dev-app/current
    echo "legacy bundle -> releases/legacy, current -> releases/legacy; apply with: depot-dev.sh up"
    ;;

  clean)
    COMPOSE_PROFILES=dev $DEV exec -T builder sh -euc '
      rm -rf /app/server/.nuxt /app/.nuxt /app/server/.output \
             /app/node_modules/.vite /app/server/node_modules/.vite \
             /app/node_modules/.cache /app/server/node_modules/.cache
      echo "builder caches cleared"
    '
    ;;

  build)
    # NODE_OPTIONS mirrors the Dockerfile build stage: nuxt build exceeds V8's
    # default heap here, and an OOM-killed vite step is exactly what poisons
    # the caches (unstyled UI from then on, zero console errors).
    COMPOSE_PROFILES=dev $DEV exec -T -e NODE_OPTIONS=--max-old-space-size=4096 builder sh -euc '
      CHANGED=0
      cmp -s /src/pnpm-lock.yaml /app/pnpm-lock.yaml || CHANGED=1
      # Sync working tree into the image workspace, keeping the container
      # node_modules volume (nested ones are symlinks into it). .nuxt is
      # builder-owned: syncing the host-side .nuxt (e.g. written by a host
      # nuxt typecheck that overlapped a build) reintroduces exactly the
      # poisoned-state class this loop kept hitting - the builder regenerates
      # it via nuxt prepare/build regardless.
      tar -C /src --exclude node_modules --exclude .git --exclude .output \
          --exclude .dev-app --exclude .nuxt -cf - . | tar -C /app -xf -
      # nuxt.config stamps the build with `git rev-parse`; the tar-synced
      # .git is host-owned and git refuses foreign ownership inside the
      # container. Trust it (this is our own synced checkout, dev only).
      git config --global --add safe.directory /app >/dev/null 2>&1 || true
      [ "$CHANGED" = 1 ] && pnpm install --frozen-lockfile
      cd /app/server && pnpm build
      # Publish blue-green: a fresh releases/<stamp> plus an atomic symlink
      # flip. Nothing already read by the running server is rewritten, so a
      # build is safe while an acquisition is downloading.
      TS=$(date -u +%Y%m%d-%H%M%S)
      mkdir -p /out/releases/$TS
      cp -a /app/server/.output/. /out/releases/$TS/
      ln -sfn releases/$TS /out/.current.tmp && mv -T /out/.current.tmp /out/current
      (cd /out/releases && ls -1dt */ 2>/dev/null | tail -n +4 | while read -r OLD; do
        OLD=${OLD%/}
        [ "releases/$OLD" = "$(readlink /out/current 2>/dev/null)" ] || rm -rf "$OLD"
      done)
      echo "published releases/$TS; current -> releases/$TS (running server untouched)"
    '
    echo "Now: depot-dev.sh restart when convenient (restarts the server; queued acquisitions die)"
    ;;

  up)
    COMPOSE_PROFILES=dev $DEV up -d gamedepot
    ;;

  restart)
    if [[ ! -e .dev-app/current ]]; then
      echo "no .dev-app/current - run depot-dev.sh build (or migrate-bundle) first" >&2
      exit 1
    fi
    # Recreate, not `restart`: compose `restart` reuses the container's
    # creation-time command, so a container created before this loop served
    # `current` (or before any docker-compose.dev.yml change) keeps booting
    # whatever path it was created with - the symlink flips and the route
    # table stop taking effect while everything still looks healthy.
    COMPOSE_PROFILES=dev $DEV up -d --force-recreate gamedepot
    echo "now serving: $(readlink .dev-app/current)"
    ;;

  rollback)
    if [[ ! -e .dev-app/current ]]; then
      echo "no .dev-app/current to roll back" >&2
      exit 1
    fi
    PREV=$(ls -1dt .dev-app/releases/*/ 2>/dev/null | sed -n 2p)
    if [[ -z "$PREV" ]]; then
      echo "only one release on disk - nothing to roll back to" >&2
      exit 1
    fi
    ln -sfn "releases/$(basename "$PREV")" .dev-app/.current.tmp
    mv -T .dev-app/.current.tmp .dev-app/current
    echo "current -> releases/$(basename "$PREV") (takes effect on next restart)"
    ;;

  down)
    COMPOSE_PROFILES=dev $DEV stop builder 2>/dev/null || true
    docker compose up -d --force-recreate gamedepot
    ;;

  *)
    echo "usage: depot-dev.sh prepare|migrate-bundle|build|clean|up|restart|rollback|down" >&2
    exit 1
    ;;
esac
