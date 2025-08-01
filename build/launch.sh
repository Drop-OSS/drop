#!/bin/bash

# This file starts up the Drop server by running migrations and then starting the executable
echo "[Drop] performing migrations..."
pnpm prisma migrate deploy

# Actually start the application
node /app/app/server/index.mjs
