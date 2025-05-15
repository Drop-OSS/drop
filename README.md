<div align="center">
<img src="https://raw.githubusercontent.com/Drop-OSS/media-sources/refs/heads/main/drop.svg" width="200rem"/>
</div>
<br/>

# Drop

[![Website](https://img.shields.io/badge/website-000000?style=for-the-badge&logo=About.me&logoColor=white)](https://droposs.org)
[![Static Badge](https://img.shields.io/badge/FORUM-blue?style=for-the-badge)](https://forum.droposs.org)
[![GitHub License](https://img.shields.io/badge/AGPL--3.0-red?style=for-the-badge)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/ACq4qZp4a9)
[![Open Collective](https://img.shields.io/badge/OpenCollective-1F87FF?style=for-the-badge&logo=OpenCollective&logoColor=white)](https://opencollective.com/drop-oss)

Drop is an open-source game distribution platform, like GameVault or Steam. It's designed to distribute and shared DRM-free game quickly, all while being incredibly flexible, beautiful and fast.

## Philosophy

1. Drop is flexible. While abstractions and interfaces can make the codebase more complicated, the flexibility is worth it.
2. Drop is secure. The nature of Drop means an instance can never be accessible without authentication. In line with #1, Drop also supports a huge variety of authentication mechanisms, from a username/password to SSO.
3. Drop is user-friendly. The interface is designed to be clean and simple to use, with complexity available to the users who want it.

## Deployment

To just deploy Drop, we've set up a simple docker compose file in deploy-template.

1. Generate a [GiantBomb API Key](https://www.giantbomb.com/api/)
2. Navigate to the deploy-template directory in your terminal (`cd deploy-template`)
3. Edit the compose.yml file (`nano compose.yml`) and copy your GiamtBomb API Key into the GIANT_BOMB_API_KEY environment variable
4. Run `docker compose up -d`

Your drop server should now be running. To register the admin user, navigate to http://your.drop.server.ip:3000/register?id=admin
and fill in the required forms

### Adding a game

To add a game to the drop library, do as follows:

1. Ensure that the current user owns the library folder with `sudo chown -R $(id -u $(whoami)) library`
2. `cd library`
3. `mkdir <GAME_NAME>` with the name of the game which you would like to register
4. `cd <GAME_NAME>`
5. `mkdir <VERSION_NAME>` Upload files for the specific game version to this folder
6. Navigate to http://your.drop.server.ip:3000/
7. Import game metadata (uses GiantBomb API Key) by selecting the game and specifying which entry to import
8. Navigate to http://your.drop.server.ip:3000/admin/library
9. You should see the game which you have just imported listed in this menu. There should be a notification that "Drop has detected you have new verions of this game to import". Select import here.
10. Select the game version to import and thus fill in fields as required.

## Tech Stack

This repo uses the Nuxt 3 + TailwindCSS stack, with the `yarn` package manager.

For the database, Drop uses Prisma connected to PostgreSQL.

## Development

To get started with development, you need `yarn --optional` and `docker compose` installed (or know how to set up a PostgreSQL database).

### Note: `--optional` flag is **REQUIRED**

Drop uses a utility package called droplet that's written in Rust. It has builts for Linux (GNU) and Windows, and they are set up as optional packages. `npm` installs these by default, but `yarn` needs the `--optional` flag.

Steps:

1. Run `git submodule update --init --recursive` to setup submodules
1. Copy the `.env.example` to `.env` and add your GiantBomb metadata key (more metadata providers coming)
1. Create the `.data` directory with `mkdir .data`
1. Ensure that your user owns the `.data` directory with `sudo chown -R $(id -u $(whoami))`
1. Open up a terminal and navigate to `dev-tools`, and run `docker compose up`
1. Open up another terminal in the root directory of the project and run `yarn` and then `yarn dev` to start the dev server

As part of the first-time bootstrap, Drop creates an invitation with the fixed id of 'admin'. So, to create an admin account, go to:

http://localhost:3000/auth/register?id=admin

## Contributing

Please see the [in-depth contributing guide](CONTRIBUTING.md)
