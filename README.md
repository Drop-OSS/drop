<div align="center">
<img src="https://raw.githubusercontent.com/Drop-OSS/media-sources/refs/heads/main/drop.svg" width="400rem"/>
</div>
<div align="center">
	<a href="CONTRIBUTING.md">Contribution guide</a>&nbsp;&nbsp;&nbsp;
	<a href="https://deepcore.dev">Our website</a>&nbsp;&nbsp;&nbsp;
</div>
<br>
<br>

[![GitHub License](https://img.shields.io/github/license/Drop-OSS/drop-app)](LICENSE)
[![Gitlab Pipeline Status](https://img.shields.io/gitlab/pipeline-status/drop-oss%2Fdrop?gitlab_url=https%3A%2F%2Flab.deepcore.dev)](https://lab.deepcore.dev/drop-oss/drop/-/pipelines)
[![Discord](https://img.shields.io/discord/1291622805124812871?label=discord)](https://discord.gg/ZVGggfXN)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

# Drop

Drop is an open-source game distribution platform, like GameVault or Steam. It's designed to distribute and shared DRM-free game quickly, all while being incredibly flexible, beautiful and fast.

## Philosophy

1. Drop is flexible. While abstractions and interfaces can make the codebase more complicated, the flexibility is worth it.
2. Drop is secure. The nature of Drop means an instance can never be accessible without authentication. In line with #1, Drop also supports a huge variety of authentication mechanisms, from a username/password to SSO.
3. Drop is user-friendly. The interface is designed to be clean and simple to use, with complexity available to the users who want it.

## Tech Stack

This repo uses the Nuxt 3 + TailwindCSS stack, with the `yarn` package manager.

For the database, Drop uses Prisma connected to PostgreSQL.

## Development

To get started with development, you need `yarn --optional` and `docker compose` installed (or know how to set up a PostgreSQL database).

### Note: `--optional` flag is **REQUIRED**

Drop uses a utility package called droplet that's written in Rust. It has builts for Linux (GNU) and Windows, and they are set up as optional packages. `npm` installs these by default, but `yarn` needs the `--optional` flag.

Steps:

1. Copy the `.env.example` to `.env` and add your GiantBomb metadata key (more metadata providers coming)
2. Create the `.data` directory with `mkdir .data`
3. Ensure that your user owns the `.data` directory with `sudo chown -R $(id -u $(whoami))`
4. Open up a terminal and navigate to `dev-tools`, and run `docker compose up`
5. Open up another terminal in the root directory of the project and run `yarn` and then `yarn dev` to start the dev server

As part of the first-time bootstrap, Drop creates an invitation with the fixed id of 'admin'. So, to create an admin account, go to:

http://localhost:3000/register?id=admin

## Contributing

Please see the [in-depth contributing guide](CONTRIBUTING.md)
