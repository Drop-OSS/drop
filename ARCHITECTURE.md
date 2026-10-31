# GameDepot Architecture

> **Status and scope.** This guide describes the repository layout and currently visible system boundaries, and documents the intended depot ingestion, chunked-delivery, and cloud-save design. The root README and roadmap describe store ingestion, content-addressed seekable-zstd delivery, delta updates, mesh distribution, and cloud saves as planned work. Diagrams for those features are reference flows, not claims that the full pipeline is already implemented. Keep implementation status aligned with the roadmap as code evolves.

## 1. System Component Overview

GameDepot is a self-hosted game library and distribution monorepo. The checked-in top-level components include a web/server application, a native desktop client, a Rust transfer service named `torrential` (with a `droplet` module), and shared libraries/packages. JavaScript/TypeScript workspace management is rooted at `pnpm-workspace.yaml`; the desktop also has a Rust/Tauri workspace.

```text
                         +-----------------------------+
                         |       GameDepot users       |
                         +--------------+--------------+
                                        |
                      HTTPS / web UI / authenticated API
                                        |
              +-------------------------v------------------------+
              |                    Server                       |
              | Nuxt application, API/routes, auth, catalog and  |
              | orchestration; Prisma-backed metadata             |
              +-----------+-------------------------+------------+
                          |                         |
              metadata / control plane     transfer requests / jobs
                          |                         |
                +---------v---------+     +---------v-----------+
                | PostgreSQL        |     | Torrential service  |
                | users, catalog,   |     | Rust transfer and   |
                | configuration     |     | archive operations  |
                +-------------------+     +-----+---------------+
                                                |
                                 local library / source objects
                                                |
                 +------------------------------+----------------+
                 |                                               |
       +---------v----------+                         +----------v---------+
       | Desktop client     |                         | CLI / automation   |
       | Tauri native shell |                         | (where configured) |
       | and web UI         |                         +--------------------+
       +---------+----------+
                 |
       +---------v-----------------------------------------------+
       | Rust client crates: client, database, download_manager, |
       | games, process, remote, cloud_saves, utils               |
       +---------------------------------------------------------+

 Planned extensions: GOG/Epic ingestion adapters, chunk manifest and
 content-addressed storage, delta sync, CDN delivery, mesh/P2P sources.
```

### Repository boundaries

| Area | Repository evidence / responsibility |
|---|---|
| `server/` | Nuxt-based server application. `server/server/` contains API, routes, plugins, middleware, and tasks; Prisma assets support persistence. Server is the control plane for user-facing requests and library metadata. |
| `desktop/` | Tauri desktop client: web front end plus native Rust host (`desktop/src-tauri/`). The Rust workspace manifest includes client, local database, download manager, game/process and remote crates, cloud saves, and utilities. |
| `torrential/` | Rust daemon/binary with `downloads/`, `droplet/`, `server/`, protocol and state modules. It is built separately in the root Dockerfile and packaged into the server runtime. |
| `libraries/`, `packages/` | Shared models and supporting packages/build artifacts. Reuse shared contract/model types rather than duplicating wire formats. |
| Root deployment | Docker build compiles Torrential and the server, then assembles a runtime with Nginx, Prisma assets, and the Torrential binary. Docker Compose and environment configuration provide the self-hosting entry point. |

## 2. Ingestion Pipeline Mechanics

The ingestion pipeline automates cataloging, provenance tracking, and staging of DRM-free game assets acquired through external store APIs, CLI backends (GOGDL, Legendary), or manual installer drops.

```text
               +---------------------------------------+
               | Store Adapter / Ingestion Trigger     |
               | (GOGDL / Legendary / Manual Upload)   |
               +-------------------+-------------------+
                                   |
                  authenticate, discover, and download
                                   |
                                   v
               +---------------------------------------+
               | Staging & Normalization Area          |
               | raw installers, metadata, asset parts |
               +-------------------+-------------------+
                                   |
                  validate length, checksums & parts
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
        +--------------------+            +--------------------+
        | Metadata Record    |            | Multi-Part / Disk  |
        | store ID, version, |            | grouping & layout  |
        | title, system reqs |            | order verification |
        +---------+----------+            +---------+----------+
                  |                                 |
                  +----------------+----------------+
                                   |
                                   v
               +---------------------------------------+
               | Publish Immutable Release Manifest    |
               | commit state to catalog and storage   |
               +-------------------+-------------------+
                                   |
                                   v
               +---------------------------------------+
               | GameDepot Library Catalog Available   |
               +---------------------------------------+
```

### Pipeline responsibilities and safeguards

1. **Account link and discovery:** Authenticate with a supported store flow and request only the scopes the adapter needs. Do not expose refresh tokens or store session material to end users or logs. Resync should be idempotent.
2. **Normalize:** Translate store-specific products, editions, builds, DLC, patches, languages, and platforms into stable GameDepot catalog/release identifiers. Preserve original store IDs as provenance.
3. **Acquire:** Treat each upstream CDN or installer URL as temporary; handle expiry, retry, range requests, and throttling in the adapter/downloader. Stage partials separately from published content.
4. **Verify and group:** Check expected length and any authoritative digest available from the source. Model multipart archives/installers as one logical release with explicit ordered parts, not as unrelated files. Never infer a missing part as successful.
5. **Publish:** Make the release visible only after required assets and metadata pass validation. Commit manifest/catalog state atomically, and retain source/version provenance so failures can be diagnosed and a release reproduced.

```text
DISCOVER -> NORMALIZE -> STAGE -> VERIFY/GROUP -> PUBLISH
    ^          |           |          |             |
    |          +--invalid--+          +--failure----+--> quarantine / retry
    +---------------------- resync / idempotent reconciliation
```

## 3. Store CDN to Seekable Zstd Streaming Flow

```text
+------------------+                    +---------------------------+
| Store API / CDN  |                    | Desktop / remote client   |
+--------+---------+                    +-------------+-------------+
         | source installer bytes                      | request release
         v                                             v
+------------------+    +--------------------+   +---------------------+
| Adapter/downloader|-->| Staging + verify  |   | Server authorizes,  |
| resumable fetch  |    | hash / size / parts|   | returns manifest & |
+------------------+    +---------+----------+   | object locations   |
                                   |              +----------+----------+
                                   v                         |
                         +--------------------+              v
                         | Pack/index (target)|    +---------------------+
                         | independent zstd  |<---| Depot object store / |
                         | frames + seek map  |    | HTTP range-capable   |
                         +---------+----------+    +---------------------+
                                   |                         |
                                   v                         v
                         +--------------------+    compressed byte ranges
                         | Immutable manifest|              |
                         | object hashes,     |              v
                         | offsets, lengths,  |    +---------------------+
                         | file map/version   |    | Concurrent fetch   |
                         +--------------------+    | into bounded buffers|
                                                            |
                                                            v
                                                 +---------------------+
                                                 | Seek index selects  |
                                                 | frame(s) for range  |
                                                 +----------+----------+
                                                            |
                                                            v
                                                 +---------------------+
                                                 | Verify compressed / |
                                                 | decoded chunk hash  |
                                                 +----------+----------+
                                                            |
                                                            v
                                                 +---------------------+
                                                 | Decode requested   |
                                                 | frames; write or    |
                                                 | serve requested data|
                                                 +---------------------+
```

For arbitrary range reads, the manifest/index must map logical file offsets to independently decodable frames (or another well-defined seekable-zstd layout). The client first resolves the requested logical range, fetches only the required compressed frame ranges using HTTP range-capable storage/CDN endpoints, verifies the expected bytes, then decodes and emits the requested span. Bound concurrency and memory; do not concatenate untrusted ranges or trust offsets without validating manifest bounds. Cache immutable objects by digest; use a new immutable manifest/release for changed content.

## 4. Depot Streamer Engine

The streamer is the transfer/data-plane boundary between an authorized manifest and a local install/read. In the current repository, Torrential is the Rust service and has a `droplet` module; seekable-zstd/content-addressed streaming is a target evolution and should remain explicitly gated by the relevant implementation.

```text
                  +--------------------------------+
                  |  Authorized Release Manifest   |
                  |  chunks, offsets, digests      |
                  +---------------+----------------+
                                  |
                                  v
                  +--------------------------------+
                  | Engine Scheduler               |
                  | concurrency & range allocator  |
                  +---------------+----------------+
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
     +--------------------------+ +--------------------------+
     | Storage / CDN Worker     | | Peer / Mesh Worker (*)   |
     | HTTP/2 range requests    | | peer source negotiation  |
     +--------------+-----------+ +-------------+------------+
                    |                           |
                    +-------------+-------------+
                                  |
                                  v
                    +---------------------------+
                    | Buffer & Assembly Queue   |
                    +-------------+-------------+
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
     +--------------------------+ +--------------------------+
     | Verify object / frame    | | Decode / extract stream  |
     | digest, length, order    | | directly to temp file    |
     +--------------+-----------+ +-------------+------------+
                    |                           |
                    +-------------+-------------+
                                  |
                                  v
                  +--------------------------------+
                  | Atomic Finalize / Installation |
                  | report progress and completion |
                  +--------------------------------+
```

`*` Local/LAN/mesh source selection is an extension described by the roadmap, not assumed to be a complete feature in the current checkout. A sound engine contract should expose source resolution, cancellation, bounded concurrency, resumability, progress, and typed failures independently of the source type. Writes should go to temporary locations and be atomically finalized only when all required data verifies; preserve timestamps/permissions only when the manifest and platform semantics require them.

## 5. Delta Sync and Chunk Verification

A version update should compare immutable manifests rather than re-download a whole title. Stable chunk identity enables reuse; only missing or changed chunks need fetching. Whole-file hashes, per-chunk hashes, and manifest/release identity protect different layers and should not be confused.

```text
  Local installed manifest                 Target release manifest
             |                                         |
             +-------------------+---------------------+
                                 v
                      +----------------------+
                      | Compare file/chunk  |
                      | identity and digest  |
                      +----------+-----------+
                                 |
             +-------------------+------------------+
             |                                      |
             v                                      v
    digest already local?                    digest absent/changed
       /          \                                  |
     yes           no                                 v
      |             |                       +---------------------+
      |             +---------------------->| fetch missing object|
      |                                     +----------+----------+
      |                                                |
      |                                                v
      |                                     +---------------------+
      |                                     | verify length/hash  |
      |                                     +-----+----------+----+
      |                                           |          |
      |                                         pass        fail
      |                                           |          +--> retry / quarantine
      +--------------------+----------------------+                |
                           v                                       +--> no publish
                +-----------------------+
                | Assemble changed file |
                | to staging destination |
                +-----------+-----------+
                            v
                +-----------------------+
                | Verify final file /   |
                | finalize atomically   |
                +-----------------------+
```

Delta flow details:

- Compare `(path, size, file digest, ordered chunk digests)` from the installed and target manifests. An unchanged digest is reusable locally; changed chunk boundaries may reduce reuse even when portions of the file are similar.
- Fetch missing objects from the depot/CDN (and, in a future mesh design, eligible peers). Resume only when partial state can be validated against the expected object identity.
- Verify each object before it enters the trusted cache. Verify assembled files before switching the install to the new release. On mismatch, discard/quarantine the bad bytes and retry from another source when available.
- Keep the old usable installation until target assembly succeeds; then atomically switch version metadata or the install pointer. A failed update should not leave the game half-updated.
- Content-addressed naming deduplicates identical objects across releases. Storage garbage collection must respect live manifests, active transfers, and retention policy.

## 6. Cloud Saves & Save Game Synchronization Engine (Ludusavi Integration)

Save game synchronization is handled natively by the desktop client's `cloud_saves` crate, leveraging the open [Ludusavi Manifest specification](https://github.com/mtkennerly/ludusavi-manifest) (compiled from PCGamingWiki and Steam API data for over 10,000+ PC games).

```text
 +--------------------------------------------------------------------+
 |                      Ludusavi Manifest Source                      |
 | (raw.githubusercontent.com/mtkennerly/ludusavi-manifest/.../yaml)  |
 +----------------------------------+---------------------------------+
                                    |
                    cached locally / ETag update checks
                                    |
                                    v
 +--------------------------------------------------------------------+
 | Desktop Client: cloud_saves crate                                  |
 |                                                                    |
 |  1. Path Resolution Engine:                                        |
 |     Resolves placeholders (<home>, <winAppData>, <winLocalAppData>,|
 |     <winDocuments>, <storeGameId>, registry keys, Wine prefixes)   |
 |                                                                    |
 |  2. File Scan & Change Detection:                                  |
 |     Fingerprint save files (mtime, SHA-256 digests)                |
 +------------------+----------------------------------+--------------+
                    |                                  ^
       POST /api/saves/upload (zstd)      GET /api/saves/download (zstd)
                    |                                  |
                    v                                  |
 +-----------------------------------------------------+--------------+
 | GameDepot Server: Save Management Control Plane                    |
 |                                                                    |
 |  - Multi-profile isolation: (userId, profileId, gameId)            |
 |  - Snapshot history & retention: versioned save trees               |
 |  - Content-addressed chunk/snapshot storage in depot               |
 +--------------------------------------------------------------------+
```

### Save Game Sync Lifecycle

```text
Game Launch Trigger
        |
        v
Check Server for Remote Changes ---- (newer remote) ----> Prompt Conflict / Auto-Pull
        |                                                                |
        | (local current or resolved)                                    |
        v                                                                v
Launch Game Process <-------------------------------------------- Restore Save Files
        |
        | (player plays game...)
        v
Game Exit Trigger (Process Monitor)
        |
        v
Scan Save Locations (via Ludusavi manifest paths)
        |
        v
Has Save Changed? (mtime / SHA-256 comparison)
       / \
     No   Yes
     |     |
    Done   v
        Compress Save Snapshot (.tar.zst)
           |
           v
        Upload Snapshot to GameDepot Server (/api/saves)
           |
           v
        Record Versioned Snapshot in Database (with profile tagging)
```

### Key Save Sync Capabilities

1. **Manifest Path Placeholders:** Handles operating system variables (`<home>`, `<winAppData>`, `<winLocalAppData>`, `<winDocuments>`, `<osUserName>`), OS registry keys on Windows, and per-game Wine/Proton prefixes on Linux and SteamOS.
2. **Path Redirects:** Maps path differences across operating systems (e.g., migrating a save created on Windows to a Proton prefix on SteamOS/Linux).
3. **Multi-Profile Isolation:** Isolates save snapshots by `(userId, profileId, gameId)`, supporting multiple household players or playthroughs without overwriting save states.
4. **Differential Versioning:** Save snapshots are compressed using Zstandard and archived with timestamps, enabling rollbacks to earlier saves in case of corruption.
5. **Conflict Resolution:** If both remote and local saves were updated while disconnected, the client detects the diverged timestamps/hashes and prompts the player with preview metadata before overwriting.

## 7. Heroic / Legendary / GOGDL Mechanics Comparison

These projects occupy different levels of the integration stack. Treat the table as an adapter-boundary comparison, not as a statement that GameDepot currently ships or invokes these integrations.

| Component | Role | GameDepot integration boundary |
|---|---|---|
| **Heroic Games Launcher** | Desktop launcher/orchestration UI for supported stores; it relies on store-specific backends rather than being the underlying Epic or GOG protocol itself. | Useful UX precedent. Do not make Heroic a required server-side service. GameDepot should own catalog identity and API and invoke the appropriate backend through a controlled adapter if desired. |
| **Legendary** | Command-line Epic Games Store client/backend, commonly used for library operations and Epic content acquisition. | Candidate Epic adapter: manage its account/session lifecycle, query library/build metadata, and stage downloadable content. Normalize its output into GameDepot records; isolate credentials and process invocation. |
| **GOGDL** | Command-line GOG downloader/backend used for GOG library/installers and related content workflows. | Candidate GOG adapter: discover owned items and acquire offline installers/updates/bonus content where supported. Preserve installer parts and metadata, then apply the same staging and verification pipeline. |

Adapter design principles: avoid hard-coding one CLI's output format into the catalog; pin and validate external binaries; capture structured errors without logging secrets; handle interactive authentication separately from headless server jobs; and verify all acquired content independently of the adapter's success exit code. Users remain responsible for lawful access and distribution of the games they own.

## 8. Trust, Persistence, and Operations

- **Authentication and authorization:** The server is the policy boundary for user and release access. Authenticate before returning private catalog, manifests, or object URLs. Scope signed/temporary URLs if used, and avoid embedding long-lived credentials in clients.
- **Metadata versus bytes:** Keep account, game, release, manifest and job state in the metadata store (PostgreSQL/Prisma where configured); keep large installer/object bytes in configured library/object storage. Maintain a clear mapping from immutable manifest object IDs to physical storage locations.
- **Safe publication:** Stage -> validate -> publish metadata is the preferred transaction boundary. Do not expose partially-ingested releases. Use atomic file moves where supported and reconciliation jobs for crash recovery.
- **Resource control:** Apply limits to concurrent downloads, extraction paths, archive entry counts, disk consumption, retries, and temporary storage. Treat archive paths and upstream manifests as untrusted input; reject traversal and unsafe links.
- **Observability:** Correlate ingestion and transfer jobs with stable IDs. Report phase, bytes, retries, verification errors, and cancellation; never log access tokens or signed URLs. Health checks should distinguish server readiness, database availability, and transfer-worker readiness.
- **Deployment:** Root Docker configuration builds the server and Torrential separately and includes runtime support for Nginx and archive extraction. Keep ports, persistent volumes, secrets, and library paths configurable for self-hosters.

## 9. Roadmap Boundary

The repository documents the following as planned evolution: GOG and Epic library ingestion via tools such as GOGDL and Legendary; multipart/multidisc installer grouping; seekable-zstd and content-addressed chunk delivery; chunk-level delta patching; peer seeding and pluggable mesh drivers; and Ludusavi-compatible cross-device cloud saves. The diagrams above give those items a coherent target shape while distinguishing them from existing repository components. Update this section and the diagram captions when milestones move from design to implementation.
