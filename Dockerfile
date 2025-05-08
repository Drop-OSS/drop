# pull pre-configured and updated build environment
FROM debian:testing-20250317-slim AS build-system

# setup workdir - has to be the same filepath as app because fuckin' Prisma
WORKDIR /app

# install dependencies and build
RUN apt-get update -y
RUN apt-get install node-corepack -y
RUN corepack enable
COPY . .
RUN NUXT_TELEMETRY_DISABLED=1 yarn install --network-timeout 1000000
RUN NUXT_TELEMETRY_DISABLED=1 yarn prisma generate
RUN NUXT_TELEMETRY_DISABLED=1 yarn build

# create run environment for Drop
FROM node:lts-slim AS run-system

WORKDIR /app

COPY --from=build-system /app/.output ./app
COPY --from=build-system /app/prisma ./prisma
COPY --from=build-system /app/package.json ./
COPY --from=build-system /app/build ./startup

# OpenSSL as a dependency for Drop (TODO: seperate build environment)
RUN apt-get update -y && apt-get install -y openssl
RUN yarn global add prisma@6.7.0

CMD ["/app/startup/launch.sh"]