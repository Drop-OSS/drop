# GameDepot Roadmap

GameDepot is an open-source, community-driven game distribution and preservation platform (hard-forked from Drop OSS). This roadmap combines multi-store ingestion, chunked depot delivery, and native client capabilities. Store access and downstream redistribution must respect each provider's terms and users' legal rights.

---

## 🗺️ Phases & Milestones

### Phase 1: Stabilization & Clean Independence
*Decouple from upstream Drop OSS dependencies, clean up CI/CD, and streamline local developer onboarding.*
- [x] **CI Silencing & Streamlining:** Removed automatic `push`/`pull_request` CI triggers, converted pipelines to manual `workflow_dispatch`, and deleted unused static pages deployments.
- [x] **Monorepo Cleanup:** Audit workspace dependencies (`pnpm`, Rust toolchains), rebrand packages (`@gamedepot/server`, `@gamedepot/desktop`, `gamedepot-desktop` crate), and ensure clean independent builds for `server`, `desktop`, `torrential`, and `droplet`.
- [x] **Turnkey Docker Stack:** Provide an all-in-one `docker-compose.yml` and `.env.example` bundling the GameDepot server, PostgreSQL with healthchecks, persistent data volumes, and reverse proxy for self-hosting.

---

### Phase 2: Multi-Store Ingestion & Depot Repackaging
*Automate library discovery and reproducible acquisition from supported storefronts through isolated, headless adapters.*
- [x] **GOG Galaxy Ingestion:** Headless account authorization, library/build discovery, direct depot file streaming via Galaxy CDN / Content-System into 4 MiB Content-Addressable Storage (CAS), and immutable DropletManifest emission.
- [x] **Epic Games Ingestion:** Headless authentication (OAuth / Legendary exchange codes), entitlement discovery, asset manifest resolution, direct chunk/file streaming into 4 MiB CAS, and worker ingestion tasks with full test suites.
- [ ] **Ubisoft Connect Ingestion (Optima adapter):** Evaluate `Starkka15/Optima` as a headless Ubisoft Connect acquisition adapter. Isolate account/session state; normalize owned products, editions and install/build metadata; stage only content the account is authorized to access. Treat it as an external, version-pinned adapter, not as GameDepot's catalog or trust boundary.
- [ ] **EA App Ingestion (Maxima adapter):** Evaluate `ArmchairDevelopers/Maxima` as a headless EA Desktop acquisition adapter. Keep credentials and provider-specific session/token handling isolated; normalize library/build metadata and acquired assets into the common pipeline. Pin/validate the external tool and independently verify its output.
- [ ] **Installer / Disc Set Support:** Group split archives and multi-disc installers into ordered logical releases; verify expected parts and preserve source provenance.
- [ ] **Common Adapter Contract:** `authorize -> discover -> normalize -> acquire -> verify -> publish`; make resync idempotent, redact secrets, and keep provider-specific formats out of shared catalog APIs.

---

### Phase 3: Player Features
*Native client functionality and integrations across devices.*
- [ ] **Cross-Device Cloud Saves:** Versioned backup, bidirectional synchronization, conflict resolution and rollback (incorporating Ludusavi manifest specifications).
- [ ] **Multi-Profile Support:** Isolated configs, play stats, accounts, and save states per profile.
- [ ] **External Launcher Integrations:** Playnite plugin, Steam Non-Steam game sync with artwork, Discord Rich Presence, and local client APIs/webhooks.
- [ ] **Personalization & Theming:** Community themes and profile customization adhering to GameDepot design system.

---

### Phase 4: Next-Gen Storage & Chunked Delivery
*Deduplicated, verifiable delivery using manifest-driven depots and seekable compression.*
- [ ] **Manifest / Chunk Depot Model:** Study DepotDownloader's Steam-style depot workflow: app/depot/build manifests enumerate paths, file metadata, chunk identities, offsets/sizes, and integrity data. Define a provider-neutral immutable manifest schema and explicit mapping from logical files to content objects; do not bind GameDepot to Steam's private protocol or require Steam credentials.
- [ ] **Chunk Acquisition & Assembly:** Support concurrent, bounded and resumable retrieval of manifest-addressed chunks; validate lengths and hashes before caching; assemble files in staging and atomically publish only after final verification.
- [ ] **Seekable Zstandard (zstd):** Repackage verified source files into independently decodable frames with an index mapping logical file ranges to compressed byte ranges. Version manifests and frame layout; verify compressed and decoded content and expose HTTP range reads where supported.
- [ ] **Steam-Style Delta Patching:** Compare old/new file and chunk identities, reuse unchanged verified objects, acquire only missing/changed chunks, and preserve the old usable install until the new release passes validation.
- [ ] **Transfer Engine Evolution (`droplet` / `torrential`):** Bounded parallel fetching, cancellation, retry, progress reporting, integrity verification, cache lifecycle, and on-demand decompression.

---

### Phase 5: Virtual LAN & Pluggable Mesh Networking
*Zero-configuration peer-to-peer distribution and private LAN multiplayer.*
- [ ] **Pluggable VPN / Mesh Driver Architecture:** Unified driver interface in server and desktop client.
- [ ] **NetBird Integration:** WireGuard mesh for private groups and LAN play.
- [ ] **Headscale / Tailscale Integration:** Self-hosted coordination support.
- [ ] **P2P Swarming:** Seed verified content objects between eligible local/meshed peers with source authorization and integrity checks.

---

### Phase 6: Native Client Polish & Linux / Steam Deck
*Unified desktop and handheld launch experience.*
- [ ] **Rich Metadata & Scrapers:** Cover art, banners, logos and screenshots.
- [ ] **Decky Loader Plugin:** Manage GameDepot library from Steam Deck Game Mode.
- [ ] **Proton / Wine Execution Layer (umu-launcher):** Evaluate UMU as a runner integration for launching Windows games on Linux and SteamOS/Steam Deck. Resolve selected Proton runner, `umu` runtime, per-game prefix and environment through a provider-independent launch contract; capture exit status/logs and allow cancellation. Runner availability and per-title compatibility remain user-configurable. Do not couple store ingestion adapters to the execution layer.
- [ ] **Linux Compatibility UX:** Detect OS/runtime and surface runner requirements, per-game launch options, prefix scope and compatibility notes.

---

## Implementation status
All unchecked items above are planned work, not claims of shipped support. External projects are integration references/adapters; review licensing, provider terms, security, maintenance and compatibility before adopting or invoking them.
