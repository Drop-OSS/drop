# syntax=docker/dockerfile:1

# Unified deps builder
FROM node:lts-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --network-timeout 1000000 --ignore-scripts

# Build for app
FROM node:lts-alpine AS build-system
# setup workdir - has to be the same filepath as app because fuckin' Prisma
WORKDIR /app

ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1

# add git so drop can determine its git ref at build
RUN apk add git

# copy deps and rest of project files
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG BUILD_DROP_VERSION="v0.0.0-unknown.1"

# build
RUN yarn postinstall
RUN yarn build

# create run environment for Drop
FROM node:lts-alpine AS run-system
WORKDIR /app

ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1

RUN yarn add --network-timeout 1000000 --no-lockfile prisma@6.7.0

COPY --from=build-system /app/package.json ./
COPY --from=build-system /app/.output ./app
COPY --from=build-system /app/prisma ./prisma
COPY --from=build-system /app/build ./startup

ENV LIBRARY="/library"
ENV DATA="/data"

CMD ["sh", "/app/startup/launch.sh"]
