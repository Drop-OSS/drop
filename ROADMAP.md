# GameDepot Roadmap

GameDepot is an open-source, community-driven game distribution and preservation platform (hard-forked from Drop OSS). This roadmap combines our next-generation chunked delivery and multi-store ingestion pipelines with all the premium/plus features previously locked behind paywalls in platforms like GameVault+ (made 100% free and open-source).

---

## 🗺️ Phases & Milestones

### Phase 1: Stabilization & Clean Independence
*Decouple from upstream Drop OSS dependencies, clean up CI/CD, and streamline local developer onboarding.*
- [x] **CI Silencing & Streamlining:** Removed automatic `push`/`pull_request` CI triggers, converted pipelines to manual `workflow_dispatch`, and deleted unused static pages deployments.
- [ ] **Monorepo Cleanup:** Audit workspace dependencies (`pnpm`, Rust toolchains) and ensure clean builds for `server`, `desktop`, `torrential`, and `droplet`.
- [x] **Turnkey Docker Stack:** Provide an all-in-one `docker-compose.yml` and `.env.example` bundling the GameDepot server (`@gamedepot/server` with Torrential daemon), PostgreSQL with automatic healthchecks, persistent data volumes, and reverse proxy for simple self-hosting.

---

### Phase 2: Multi-Store Ingestion (The Depot Pipeline)
*Automate cataloging, updates, and ingestion from legal DRM-free stores.*
- [ ] **GOG Store Ingestion:**
  - Headless OAuth flow for GOG accounts.
  - Automatic download and sync of offline installer binaries, patches, DLC, and bonus content (via `gogdl` / GOG Galaxy APIs).
- [ ] **Epic Games Store Integration:**
  - Headless authentication and library sync using `legendary`.
  - Automatic manifest fetching and game installation imports.
- [ ] **Multi-part / Multi-disc Installer Support:**
  - Automated scanning, grouping, and metadata tagging for multi-part installers (e.g. vintage 2+ CD-ROM `.bin` / `.exe` sets).

---

### Phase 3: Premium Player Features (Formerly GameVault+ Paywalled)
*Every premium convenience feature from GameVault+ built natively into GameDepot, free and unrestricted under AGPL-3.0.*
- [ ] **Cross-Device Cloud Saves:**
  - Automated save game backup and bidirectional synchronization between client devices.
  - Versioned save history with conflict resolution and rollback support.
- [ ] **Multi-Profile Support:**
  - Switch between multiple user profiles / accounts per client installation with isolated configs, play stats, and save states.
- [ ] **External Launcher Integrations:**
  - **Playnite Integration:** Dedicated Playnite plugin to browse, install, and launch GameDepot titles.
  - **Steam Non-Steam Game Sync:** Auto-add installed GameDepot games to local Steam client with grid/hero banners.
  - **Discord Rich Presence:** Dynamic presence showing current game, playtime, and server/mesh status.
- [ ] **Personalization & Theming:**
  - Animated user profile pictures / avatars.
  - Custom client themes (CSS / theme engine with community theme support).
- [ ] **Open Client APIs & Webhooks:**
  - Local REST / WebSocket Client APIs allowing third-party tools, deck plugins (Decky Loader), and launchers to control GameDepot installations.

---

### Phase 4: Next-Gen Storage & Chunked Delivery
*Fast, deduplicated, and seekable game streaming to replace monolithic archive downloads.*
- [ ] **Seekable Zstandard (zstd) Chunking:**
  - Segment games into content-addressed chunks compressed with seekable zstd.
- [ ] **Steam-Style Delta Patching:**
  - Compute chunk-level diffs between game versions; download only altered blocks during game updates.
- [ ] **Transfer Engine Evolution (`droplet` / `torrential`):**
  - High-throughput parallel block retrieval, verification, and on-the-fly decompression.

---

### Phase 5: Virtual LAN & Pluggable Mesh Networking
*Zero-configuration peer-to-peer distribution and private LAN multiplayer.*
- [ ] **Pluggable VPN / Mesh Driver Architecture:**
  - Unified driver interface in server and desktop client for mesh coordinators.
- [ ] **NetBird Integration:**
  - Zero-config WireGuard mesh for private friends groups and low-latency virtual LAN play.
- [ ] **Headscale / Tailscale Integration:**
  - First-class support for self-hosted Headscale coordinators.
- [ ] **P2P Swarming (LAN/Mesh Seeding):**
  - Allow local or meshed peers to seed chunks directly to one another to eliminate depot bandwidth bottlenecks.

---

### Phase 6: Native Client Polish & Steam Deck Support
*The ultimate unified desktop launcher experience.*
- [ ] **Hardware Compatibility & System Spec Checker ("Can You Run It?"):**
  - Native client hardware probe (CPU model/instructions, GPU VRAM & driver level, Total RAM, available disk space, OS/DirectX/Vulkan support via `sysinfo` / Rust).
  - Automated parsing of scraped minimum & recommended requirements (from Steam, PCGamingWiki, or IGDB).
  - Visual compatibility badge on game pages (e.g. *Meets Recommended*, *Meets Minimum*, *Insufficient Specs*, *Warning: Disk Space / GPU*).
- [ ] **Rich Metadata & Scrapers:**
  - Automated cover art, hero banners, logos, and screenshots via IGDB and SteamGridDB.
- [ ] **Decky Loader Plugin:**
  - Native Decky plugin for Steam Deck users to install and manage games directly in Game Mode.
- [ ] **Wine / Proton / Runner Management:**
  - One-click launch scripts and Proton runner assignment for Linux and SteamOS.
