# syntax=docker/dockerfile:1

FROM node:lts-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# so corepack knows pnpm's version
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# prevent prompt to download
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# setup for offline
RUN corepack pack
# don't call out to network anymore
ENV COREPACK_ENABLE_NETWORK=0

### Unified deps builder
FROM base AS deps
RUN pnpm install --frozen-lockfile --ignore-scripts

### Build for app
FROM base AS build-system

ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1

# add git so drop can determine its git ref at build
RUN apk add --no-cache git

# copy deps and rest of project files
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG BUILD_DROP_VERSION
ARG BUILD_GIT_REF

# build
RUN pnpm run postinstall && pnpm run build

### create run environment for Drop
FROM base AS run-system

ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1

# RUN --mount=type=cache,target=/root/.yarn YARN_CACHE_FOLDER=/root/.yarn yarn add --network-timeout 1000000 --no-lockfile --ignore-scripts prisma@6.11.1
RUN apk add --no-cache pnpm
RUN pnpm install prisma@6.11.1

COPY --from=build-system /app/package.json ./
COPY --from=build-system /app/.output ./app
COPY --from=build-system /app/prisma ./prisma
COPY --from=build-system /app/build ./startup

ENV LIBRARY="/library"
ENV DATA="/data"

CMD ["sh", "/app/startup/launch.sh"]
