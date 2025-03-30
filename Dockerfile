# pull pre-configured and updated build environment
FROM debian:testing-20250317-slim AS build-system

# setup workdir
RUN mkdir /build
WORKDIR /build

# install dependencies and build
RUN apt-get update -y
RUN apt-get install node-corepack -y
RUN corepack enable
COPY . .
RUN NUXT_TELEMETRY_DISABLED=1 yarn install
RUN NUXT_TELEMETRY_DISABLED=1 yarn build

# create run environment for Drop
FROM node:lts-slim AS run-system

RUN mkdir /app
WORKDIR /app

COPY --from=build-system /build/.output ./app
COPY --from=build-system /build/prisma ./prisma
COPY --from=build-system /build/build ./startup

# OpenSSL as a dependency for Drop (TODO: seperate build environment)
RUN apt-get update -y && apt-get install -y openssl
RUN yarn global add prisma

CMD ["/app/startup/launch.sh"]