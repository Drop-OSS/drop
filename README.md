# GameDepot

[![GitHub License](https://img.shields.io/badge/AGPL--3.0-red?style=for-the-badge)](LICENSE)

GameDepot is a self-hosted, open-source game distribution platform and modern Steam/GameVault alternative. It allows you to preserve, store, and stream your DRM-free game library directly to your devices and friends with high transfer efficiency and zero-config mesh networking.

> [!NOTE]
> **GameDepot is an independent hard fork of [Drop OSS](https://github.com/Drop-OSS/drop).**
> While upstream Drop has entered maintenance mode with a strict policy against AI contributions, GameDepot embraces AI-assisted engineering and rapid experimentation to evolve the platform with automated game ingestion, next-generation compression, and flexible mesh networking.

---

## Key Features & Roadmap

- **Multi-Store Game Ingestion & Updates:**
  - Automated integration with **GOG** and **Epic Games Store** (via OAuth & CLI backends like `gogdl` and `legendary`).
  - Keep game releases, patches, and DLC automatically downloaded and synchronized in your personal depot.

- **Next-Gen Storage & Chunked Delivery:**
  - Fast chunking engine powered by **Zstandard (seekable zstd)** and content-addressed storage.
  - Granular delta patching and deduplication inspired by Steam depots, saving massive bandwidth and disk space.
  - Multi-disc and multi-part installer support (e.g. vintage 2+ CD-ROM games).

- **Pluggable Mesh Networking & Virtual LAN:**
  - Integrated peer-to-peer mesh connectivity for zero-config remote downloads and LAN multiplayer.
  - Pluggable VPN driver architecture supporting both **NetBird** and **Headscale**.

- **Open & Unrestricted Engineering:**
  - AI-assisted development friendly.
  - Rapid release cycle without upstream bureaucracy.

---

## Architecture Overview

GameDepot is structured as a modern monorepo:

- **Desktop Client:** Tauri + Svelte/TypeScript client providing a native desktop experience.
- **Backend Server:** Node.js/TypeScript backend managing depot metadata, authentication, storage providers, and mesh orchestration.
- **Transfer Engine (`droplet`):** High-performance Rust binary handling chunked, concurrent game file streaming and extraction.

---

## Contributing

We welcome all community contributions, feature discussions, bug reports, and pull requests! AI-assisted tooling and contributions are fully permitted and supported.

## License

This project is licensed under the [AGPL-3.0 License](LICENSE), honoring the original licensing of Drop OSS.
