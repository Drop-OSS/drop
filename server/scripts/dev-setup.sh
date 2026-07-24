#!/usr/bin/env bash
# dev-setup.sh — prepare a fresh clone for local development
# Validates system deps, creates .env from template, generates Prisma client,
# and prepares Nuxt. Idempotent: safe to re-run.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SERVER_DIR"

step() { printf "\033[1;34m==>\033[0m %s\n" "$1"; }
warn() { printf "\033[1;33m[!]\033[0m %s\n" "$1"; }

step "Checking Node version (need >= 22.16)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  warn "Node $NODE_MAJOR detected. Drop server requires Node >= 22.16."
  exit 1
fi

step "Checking pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm not found. Install via corepack: \`corepack enable && corepack prepare pnpm@11.17.0 --activate\`"
  exit 1
fi

step "Creating .env from template"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    Created .env (edit with your local config)"
else
  echo "    .env already exists — skipping"
fi

step "Generating Prisma client"
pnpm exec prisma generate

step "Preparing Nuxt"
pnpm exec nuxt prepare

step "Setup complete"
echo "    Run \`pnpm dev\` to start the server"
echo "    Run \`pnpm test\` to run tests"
echo "    Run \`pnpm typecheck\` to typecheck"
