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
- [x] **Ubisoft Connect Ingestion (Optima adapter):** Evaluate `Starkka15/Optima` as a headless Ubisoft Connect acquisition adapter. Isolate account/session state; normalize owned products, editions and install/build metadata; stage only content the account is authorized to access. Treat it as an external, version-pinned adapter, not as GameDepot's catalog or trust boundary.
- [x] **EA App Ingestion (in-house cleanroom DIP streamer):** Implement a headless in-repo provider adapter; `ArmchairDevelopers/Maxima` (`maxima-lib/src/content/downloader.rs`, `manager.rs`, `dip.rs`, `endpoints.rs`) is reference-only, with no code copied, following the `Starkka15/Optima` Ubisoft precedent already documented in `ARCHITECTURE.md`.
  1. Nucleus OIDC authentication via `accounts.ea.com` (plain HTTP).
  2. Entitlements/discovery via `ecommerce2.dm.origin.com` and Juno GraphQL at `service-aggregation-layer.juno.ea.com`.
  3. Resolve DIP URLs through `ContentService.download_url`; parse the remote ZIP central directory to obtain entry offsets, compressed/uncompressed sizes and compression methods without downloading the whole archive.
  4. Acquire each entry with HTTP Range requests, inflate it, then stream raw files into the 4 MiB CAS; verify each entry's CRC32 and fail closed on corruption or exhausted retries.
  5. Skip the touchup installer. Caveat: a few titles patch files post-touchup, so streamed DIP bytes may not be byte-identical to the final touched-up files.
  6. Emit an immutable `DropletManifest` like GOG/Epic/Ubisoft; discard EA per-file Deflate so GameDepot's own documented compression/chunking, cross-provider dedupe and idempotent resync apply.
- [x] **Installer / Disc Set Support:** Group split archives and multi-disc installers into ordered logical releases; verify expected parts and preserve source provenance.
- [x] **Common Adapter Contract:** `authorize -> discover -> normalize -> acquire -> verify -> publish`; make resync idempotent, redact secrets, and keep provider-specific formats out of shared catalog APIs.
  - All four provider streamers (GOG, Epic, Ubisoft, EA) are ported onto it: each module keeps only provider knowledge and hands files to `stageAdapterRelease()` (`server/server/utils/adapter/contract.ts`), which owns path validation, chunk re-framing, size/digest verification and atomic publication.
- [x] **Store Connection Flows:** Heroic-style one-time sign-in for GOG and Epic persists an account connection (`api/admin/depot/connection/{gog,epic}` authorize/callback; EA offers the `login-url` initiator), lifecycle routes are gated with system ACLs, and GOG acquisition runs as a real persisted task.

---

### Phase 3: Player Features
*Native client functionality and integrations across devices.*
- [ ] **Cross-Device Cloud Saves:** Versioned backup, bidirectional synchronization, conflict resolution and rollback (incorporating Ludusavi manifest specifications).
  1. Server foundation (implemented): immutable `SaveVersion` history behind a movable slot head, content-identity hashes separate from archive checksums, `If-Match` optimistic concurrency with `409` conflicts, `Idempotency-Key` upload replays, restore-as-a-new-version, pinning, retention pruning with reference-counted object GC, a `sync` decision endpoint (`noop | push | pull | converged | conflict`, never decided by clocks), and per-game Ludusavi manifest reads. Legacy `historyObjectIds` arrays are backfilled and kept read-only for one release.
  2. Server verification (implemented): the save service is driven end to end against a real PostgreSQL 16 and the real filesystem object store (`pnpm e2e:saves`): head swap, stale-`If-Match` conflict leaving no row or object behind, `Idempotency-Key` replay, archive dedupe, every sync decision, gapless timeline paging, restore, pinning, retention pruning with reference-counted object GC, download byte-identity, the legacy `push` path, slot rules and size limits — 16 checks. A second driver (`pnpm e2e:saves-http`) exercises the HTTP contract against a live server — client-JWT auth, the capability gate, `If-Match` / `Idempotency-Key` / `X-Content-Hash` headers, the `409` body carrying `headVersionId`, download identity headers and ETag, restore/pin/delete, manifest reads and cross-user isolation — 16 more. Both are standalone scripts guarded to scratch-named databases (the suite itself has no database fixture); the migration's backfill is verified on PostgreSQL 16 and the pure modules are unit-tested.
  3. Desktop engine: resolve Ludusavi placeholders per platform and Proton prefix, build deterministic `tar.zstd` archives keyed by the manifest template tail, back up on process exit and pull before launch only when the local save is clean. `desktop/src-tauri/cloud_saves` holds an unwired prototype of this (placeholder expansion, path normalisation, tar/zstd helpers): it is a workspace member nothing depends on, has no tests, and never talks to the server.
  4. Client UX: version timeline per slot, rollback, and the always-ask conflict choice (keep local, keep server, or keep both).
- [ ] **Multi-Profile Support:** Isolated configs, play stats, accounts, and save states per profile.
- [ ] **External Launcher Integrations:** Playnite plugin, Steam Non-Steam game sync with artwork, Discord Rich Presence, and local client APIs/webhooks.
- [ ] **Personalization & Theming:** Community themes and profile customization adhering to GameDepot design system.

---

### Phase 4: Next-Gen Storage & Chunked Delivery
*Deduplicated, verifiable delivery using manifest-driven depots and seekable compression.*
- [x] **Manifest / Chunk Depot Model:** Study DepotDownloader's Steam-style depot workflow: app/depot/build manifests enumerate paths, file metadata, chunk identities, offsets/sizes, and integrity data. Define a provider-neutral immutable manifest schema and explicit mapping from logical files to content objects; do not bind GameDepot to Steam's private protocol or require Steam credentials.
  - Shipped as `gamedepot-droplet` v1: fixed 4 MiB content-addressed chunks, per-file `path`/`size`/`sha256` with ordered chunk identities, a `chunkIndex` mapping each chunk digest to its content object, and a canonical-JSON digest making every manifest self-digesting. Provider adapters emit it; nothing in the schema is store-specific.
  - Still open: the desktop download agent (`droplet`) speaks upstream's own 64 MiB chunk manifest, so the two formats are not yet unified — that is what the next item has to close.
- [ ] **Chunk Acquisition & Assembly:** Support concurrent, bounded and resumable retrieval of manifest-addressed chunks; validate lengths and hashes before caching; assemble files in staging and atomically publish only after final verification.
  - Bounded concurrency and resume already exist in `desktop/src-tauri/download_manager` (`SyncSemaphore` over active downloads, `resume_downloads`). What is missing is the verification order the item asks for: hash and length checks before a blob is treated as cached, and staging plus an atomic publish instead of writing into place, so an interrupted download can never leave a usable-looking half file.
- [ ] **Seekable Zstandard (zstd):** Repackage verified source files into independently decodable frames with an index mapping logical file ranges to compressed byte ranges. Version manifests and frame layout; verify compressed and decoded content and expose HTTP range reads where supported.
- [ ] **Steam-Style Delta Patching:** Compare old/new file and chunk identities, reuse unchanged verified objects, acquire only missing/changed chunks, and preserve the old usable install until the new release passes validation.
- [ ] **Transfer Engine Evolution (`droplet` / `torrential`):** Bounded parallel fetching, cancellation, retry, progress reporting, integrity verification, cache lifecycle, and on-demand decompression.

---

### Phase 5: Virtual LAN & Pluggable Mesh Networking
*Zero-configuration peer-to-peer distribution and private LAN multiplayer.*
- [ ] **Pluggable VPN / Mesh Driver Architecture:** Unified driver interface in server and desktop client.
- [ ] **NetBird Integration:** WireGuard mesh for private groups and LAN play.
- [ ] **Headscale / Tailscale Integration:** Self-hosted coordination support.
  - `desktop/src-tauri/tailscale` is an orphan from upstream: it is not a workspace member, no crate depends on it and no page calls it. Treat it as dead code to revive or delete, not as an existing integration.
- [ ] **P2P Swarming:** Seed verified content objects between eligible local/meshed peers with source authorization and integrity checks.

---

### Phase 6: Native Client Polish & Linux / Steam Deck
*Unified desktop and handheld launch experience.*
- [x] **Rich Metadata & Scrapers:** Cover art, banners, logos and screenshots.
  - Fetched by `server/server/internal/metadata` (IGDB, Giant Bomb, Steam, PCGamingWiki, manual) into the `m*` cache fields (`mIconObjectId`, `mBannerObjectId`, `mCoverObjectId`, `mImageCarouselObjectIds`), with user-uploaded screenshots alongside. There is no dedicated logo asset field; logos ride on the icon and cover set.
- [ ] **Decky Loader Plugin:** Manage GameDepot library from Steam Deck Game Mode.
- [x] **Proton / Wine Execution Layer (umu-launcher):** Evaluate UMU as a runner integration for launching Windows games on Linux and SteamOS/Steam Deck. Resolve selected Proton runner, `umu` runtime, per-game prefix and environment through a provider-independent launch contract; capture exit status/logs and allow cancellation. Runner availability and per-title compatibility remain user-configurable. Do not couple store ingestion adapters to the execution layer.
  - `desktop/src-tauri/client/src/compat.rs` resolves an installed `umu` launcher and builds the compat environment, `process/src/compat.rs` discovers Proton installs, and `process/src/process_handlers.rs` launches native Linux builds directly and Windows builds through `umu-run` with a per-game app ID override; prefixes stay per game under the desktop data root, and `process/src/process_manager.rs` kills the whole process tree and records the exit status.
- [x] **Linux Compatibility UX:** Detect OS/runtime and surface runner requirements, per-game launch options, prefix scope and compatibility notes.
  - `desktop/main/pages/settings/compat.vue` reports whether the UMU launcher is installed and configures the compat layer, `components/GameOptions/ProtonSelector.vue` picks a discovered or custom Proton path per game, `GameOptions/Launch.vue` overrides the launch string, and `HeaderProtonSupportWidget.vue` surfaces whether the selected title is expected to run.

---

## Implementation status
All unchecked items above are planned work, not claims of shipped support. External projects are integration references/adapters; review licensing, provider terms, security, maintenance and compatibility before adopting or invoking them.
EA App endpoints are implemented, but live-service verification remains outstanding (hermetic tests only). The common adapter contract is in force: every provider streamer acquires through `stageAdapterRelease()`; Epic's binary build manifests remain undecoded on purpose (proprietary format) and are resolved via the launcher content API instead.
Cross-device cloud saves: the server half is implemented (versioned save history, sync decisions, Ludusavi manifest reads, versioned client API) and verified against live infrastructure — 32 end-to-end checks (`pnpm e2e:saves`, `pnpm e2e:saves-http`) drive the service against a real PostgreSQL 16 plus object store and the HTTP contract against a live server. The desktop half is a prototype crate that no code depends on.
Every tick carries a note naming the files behind it and what is still missing, so a tick can be re-checked without auditing the tree again.

---

## 💡 Future idea: Cache Node (read-through depot cache for LAN/offline use)
A small node that sits between clients and the main GameDepot server so LAN parties and offline setups pull bytes locally instead of over the WAN.

### Milestone 1 — Proxy node (plumbing, low risk)
- Small Docker image (the repo-root `Dockerfile`/`docker-compose.yml` can be extended or run in parallel) that fronts the main GameDepot server.
- Manifest + metadata requests: always forwarded live to upstream (tiny, keeps versions in sync automatically).
- Content/blob requests: forwarded upstream (no caching yet); auth tokens validated against upstream so the node can't act as an open proxy.
- Client gets a "cache URL" config that overrides the server URL.

### Milestone 2 — Blob cache
- Content-addressed cache on the node's volume — since the depot layer is content-addressed, a cached blob can never be stale; eviction = drop a file, no invalidation logic.
- LRU eviction with a disk quota.
- Serve-on-miss (proxy) vs. cache-only mode (only serve what's pre-cached).

### Milestone 3 — Admin control of what's cached
- Server-side admin UI action: "pre-cache game/version → node X" so the cache can be filled over the home connection before the LAN party.
- Pin games (never evict); everything else LRU.
- Node status view: disk usage, what's resident, cache hit stats.

**Suggested placement:** before/alongside user libraries — the Epic appName correctness fix already landed (appName is required by the ingest route, sent in the launcher-assets query and used in the manifest download URL `/appName/<name>/manifest/`), so it no longer gates this work. The cache key design (game vs. per-chunk) should still be decided early because it affects the ingest manifest format.

**Design decision to settle first:** per-chunk caching vs. whole-file caching. Per-chunk is what makes pre-caching and bandwidth-sharing cheap, but it couples to the depot download protocol more tightly. Current lean: per-chunk, since the protocol already streams in chunks.
