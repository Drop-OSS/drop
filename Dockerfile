# syntax=docker/dockerfile:1

FROM node:lts-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

## so corepack knows pnpm's version
COPY . .
## prevent prompt to download
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
## setup for offline
RUN corepack pack
## don't call out to network anymore
ENV COREPACK_ENABLE_NETWORK=0

### INSTALL DEPS ONCE
FROM base AS deps
RUN pnpm install --frozen-lockfile --ignore-scripts

### BUILD TORRENTIAL
FROM rustlang/rust:nightly-alpine AS torrential-build
RUN apk add musl-dev pkgconfig libarchive-dev libarchive
WORKDIR /build
COPY . .
RUN apk add protoc
RUN cargo build --release --manifest-path ./torrential/Cargo.toml

### BUILD APP
FROM base AS build-system

ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1

## add git so drop can determine its git ref at build
RUN apk add --no-cache git

## copy deps and rest of project files
COPY . .
COPY --from=deps /app/node_modules ./node_modules


ARG BUILD_DROP_VERSION
ARG BUILD_GIT_REF

## build
RUN pnpm run --filter=drop postinstall && pnpm run --filter=drop build


# create run environment for Drop
FROM base AS run-system

ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1

# RUN --mount=type=cache,target=/root/.yarn YARN_CACHE_FOLDER=/root/.yarn yarn add --network-timeout 1000000 --no-lockfile --ignore-scripts prisma@6.11.1
RUN apk add --no-cache pnpm 7zip nginx
RUN pnpm install prisma@7.3.0 --global
# init prisma to download all required files
RUN pnpm prisma init

COPY --from=build-system /app/server/prisma.config.ts ./
COPY --from=build-system /app/server/.output ./app
COPY --from=build-system /app/server/prisma ./prisma
COPY --from=build-system /app/server/build ./startup
COPY --from=build-system /app/server/build/nginx.conf /nginx.conf
COPY --from=torrential-build /build/torrential/target/release/torrential /usr/bin/

ENV LIBRARY="/library"
ENV DATA="/data"
ENV NGINX_CONFIG="/nginx.conf"
# Nuxt's port
ENV PORT=4000

CMD ["sh", "/app/startup/launch.sh"]
