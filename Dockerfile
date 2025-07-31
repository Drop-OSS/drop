# syntax=docker/dockerfile:1

### Unified deps builder
# FROM node:lts-alpine AS deps
# WORKDIR /app
# COPY package.json yarn.lock ./
# RUN --mount=type=cache,target=/root/.yarn YARN_CACHE_FOLDER=/root/.yarn yarn install --network-timeout 1000000 --ignore-scripts

### Build for app
FROM node:lts-alpine AS build-system
# setup workdir - has to be the same filepath as app because fuckin' Prisma
WORKDIR /app

ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1
# ENV YARN_CACHE_FOLDER=/root/.yarn

# add git so drop can determine its git ref at build
# pnpm for build
RUN apk add --no-cache git pnpm

# copy deps and rest of project files
# COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG BUILD_DROP_VERSION
ARG BUILD_GIT_REF

# build
RUN pnpm import
RUN pnpm install
RUN pnpm run build
# RUN --mount=type=cache,target=/root/.yarn yarn postinstall && yarn build

### create run environment for Drop
FROM node:lts-alpine AS run-system
WORKDIR /app

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
