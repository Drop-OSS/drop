<div align="center">
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="30em">
        <path
            d="M4 13.5C4 11.0008 5.38798 8.76189 7.00766 7C8.43926 5.44272 10.0519 4.25811 11.0471 3.5959C11.6287 3.20893 12.3713 3.20893 12.9529 3.5959C13.9481 4.25811 15.5607 5.44272 16.9923 7C18.612 8.76189 20 11.0008 20 13.5C20 17.9183 16.4183 21.5 12 21.5C7.58172 21.5 4 17.9183 4 13.5Z"
            stroke="#60a5fa" stroke-width="2" />
    </svg>	
</div>
<p align="center">
	<a href="contributing.md">Contribution guide</a>&nbsp;&nbsp;&nbsp;
	<a href="https://deepcore.dev">Our website</a>&nbsp;&nbsp;&nbsp;
</p>
<br>
<br>

[![GitHub License](https://img.shields.io/github/license/Drop-OSS/drop-app)](LICENSE)
![Gitlab Pipeline Status](https://img.shields.io/gitlab/pipeline-status/drop-oss%2Fdrop?gitlab_url=https%3A%2F%2Flab.deepcore.dev)
[![Discord](https://img.shields.io/discord/1291622805124812871?label=discord)](https://discord.gg/ZVGggfXN)
[![Static Badge](https://img.shields.io/badge/contributions-welcome-blue)](https://github.com/Drop-OSS/drop/blob/main/README.md)


# Drop 
Drop is an open-source game distribution platform, like GameVault or Steam. It's designed to distribute and shared DRM-free game quickly, all while being incredibly flexible, beautiful and fast. 

## Philosophy
1. Drop needs to be flexible. If you look at the code base, there are lots of interfaces and abstractions and generic classes. While these do make Drop a bit heavier, they create the much needed flexibility, modularity and future-proofing that Drop needs.
2. Drop needs to be secure. Always have security in mind when designing new features for Drop. 
3. Drop needs to be user-friendly. Follow good design principles, and don't overload the user with too much information at once. Balance hiding things between menus and showing it all at once. 

## The Tech Stack
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

To create an account:
Head over to the `/register` page. It's currently a temporary development form for creating a username + password log in.

## Contributing
Please see the [in-depth contributing guide](https://github.com/Drop-OSS/drop/blob/main/CONTRIBUTING.md)