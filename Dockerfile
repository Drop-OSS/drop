# pull pre-configured and updated build environment
FROM registry.deepcore.dev/drop-oss/drop-server-build-environment/main:latest AS build-system

# setup workdir
RUN mkdir /build
WORKDIR /build

# install dependencies and build
COPY . .
RUN yarn install --non-interactive
RUN yarn build

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