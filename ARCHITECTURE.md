# GameDepot Architecture

> **Status and scope.** This guide describes the repository layout and currently visible system boundaries, and documents the intended depot ingestion and chunked-delivery design. The root README and roadmap describe store ingestion, content-addressed seekable-zstd delivery, delta updates, and mesh distribution as planned work. Diagrams for those features are reference flows, not claims that the full pipeline is already implemented. Keep implementation status aligned with the roadmap as code evolves.

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

The server and transfer engine form separate control and data planes. The server authorizes and describes work; the transfer service performs file/stream operations. A local/remote client consumes server metadata and coordinates installation. Keep high-volume bytes out of metadata persistence where possible.

## 2. Ingestion Pipeline Mechanics

Ingestion turns a store-owned library entry and its distributable files into a versioned GameDepot release. Store credentials and adapters remain isolated from the public download endpoint. GOG and Epic/Legendary ingestion and installer grouping are roadmap items; the following flow is a target design.

```text
  Admin links store account
              |
              v
  +-----------------------+       encrypted / scoped credentials
  | Store adapter         |<--------------------------------+
  | GOGDL or Legendary    |                                 |
  +-----------+-----------+                                 |
              | library, release and asset metadata         |
              v                                             |
  +-----------------------+      +--------------------------+
  | Normalize identity    |----->| Catalog / release record |
  | title, platform, DLC, |      | stable GameDepot IDs     |
  | patch, language       |      +------------+-------------+
  +-----------------------+                   |
                                              v
  +-----------------------+        +------------------------+
  | Download source files |------->| Staging area           |
  | direct store/CDN URLs | bytes  | resumable, quarantined |
  +-----------------------+        +-----------+------------+
                                               |
                  +----------------------------+----------------------+
                  |                            |                      |
                  v                            v                      v
       verify size/checksum          group split/disc files   scan metadata /
       and source identity            and installer parts      optional policy
                  |                            |                      |
                  +----------------------------+----------------------+
                                               |
                                               v
                            +-------------------------------+
                            | Publish immutable release    |
                            | file list / manifest / state |
                            +---------------+---------------+
                                            |
                              update catalog and availability
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

There are two distinct transfers: **upstream ingestion** from a store CDN into the self-hosted depot, and **downstream delivery** from the depot to a client. A store's installer object is not automatically a seekable-zstd object. A packing/indexing stage would have to create and publish a depot representation plus a manifest; the roadmap calls out seekable-zstd chunking as planned work.

```text
UPSTREAM / PUBLISH                              CLIENT / READ

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
+-----------------+      manifest / job      +-------------------------+
| Server control  |------------------------->| Torrential service      |
| auth, release,  |                          | request coordinator     |
| authorization  |<-------------------------| status / progress       |
+-----------------+                          +-----------+-------------+
                                                         |
                                  +----------------------+----------------+
                                  |                      |                |
                                  v                      v                v
                         +----------------+     +----------------+ +-------------+
                         | Source resolver|     | Scheduler      | | Local cache |
                         | depot/CDN,     |---->| bounded workers|<| verified    |
                         | local/mesh*    |     | retries/cancel| | objects     |
                         +----------------+     +-------+--------+ +-------------+
                                                        |
                               +------------------------+--------------------+
                               |                                             |
                               v                                             v
                    +-----------------------+                    +----------------------+
                    | Verify object/frame  |                    | Decode / extract    |
                    | digest, length, order|                    | stream to temp file |
                    +-----------+-----------+                    +----------+-----------+
                                +----------------------+--------------------+
                                                       |
                                                       v
                                         +----------------------------+
                                         | Atomic finalize / install  |
                                         | report progress and result |
                                         +----------------------------+
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

## 6. Heroic / Legendary / GOGDL Mechanics Comparison

These projects occupy different levels of the integration stack. Treat the table as an adapter-boundary comparison, not as a statement that GameDepot currently ships or invokes these integrations.

| Component | Role | GameDepot integration boundary |
|---|---|---|
| **Heroic Games Launcher** | Desktop launcher/orchestration UI for supported stores; it relies on store-specific backends rather than being the underlying Epic or GOG protocol itself. | Useful UX precedent. Do not make Heroic a required server-side service. GameDepot should own catalog identity and API and invoke the appropriate backend through a controlled adapter if desired. |
| **Legendary** | Command-line Epic Games Store client/backend, commonly used for library operations and Epic content acquisition. | Candidate Epic adapter: manage its account/session lifecycle, query library/build metadata, and stage downloadable content. Normalize its output into GameDepot records; isolate credentials and process invocation. |
| **GOGDL** | Command-line GOG downloader/backend used for GOG library/installers and related content workflows. | Candidate GOG adapter: discover owned items and acquire offline installers/updates/bonus content where supported. Preserve installer parts and metadata, then apply the same staging and verification pipeline. |

```text
                      +------------------------------+
                      | GameDepot ingestion contract|
                      | discover -> normalize ->     |
                      | acquire -> verify -> publish |
                      +---------------+--------------+
                                      |
                    +-----------------+-------------------+
                    |                                     |
                    v                                     v
             +--------------+                      +--------------+
             | Legendary    |                      | GOGDL        |
             | Epic backend |                      | GOG backend  |
             +------+-------+                      +------+-------+
                    |                                     |
                    +-----------------+-------------------+
                                      v
                             Store APIs / CDNs

          Heroic is a user-facing orchestrator/reference, not the
          shared backend contract that replaces these store adapters.
```

Adapter design principles: avoid hard-coding one CLI's output format into the catalog; pin and validate external binaries; capture structured errors without logging secrets; handle interactive authentication separately from headless server jobs; and verify all acquired content independently of the adapter's success exit code. Users remain responsible for lawful access and distribution of the games they own.

## 7. Trust, Persistence, and Operations

- **Authentication and authorization:** The server is the policy boundary for user and release access. Authenticate before returning private catalog, manifests, or object URLs. Scope signed/temporary URLs if used, and avoid embedding long-lived credentials in clients.
- **Metadata versus bytes:** Keep account, game, release, manifest and job state in the metadata store (PostgreSQL/Prisma where configured); keep large installer/object bytes in configured library/object storage. Maintain a clear mapping from immutable manifest object IDs to physical storage locations.
- **Safe publication:** Stage -> validate -> publish metadata is the preferred transaction boundary. Do not expose partially-ingested releases. Use atomic file moves where supported and reconciliation jobs for crash recovery.
- **Resource control:** Apply limits to concurrent downloads, extraction paths, archive entry counts, disk consumption, retries, and temporary storage. Treat archive paths and upstream manifests as untrusted input; reject traversal and unsafe links.
- **Observability:** Correlate ingestion and transfer jobs with stable IDs. Report phase, bytes, retries, verification errors, and cancellation; never log access tokens or signed URLs. Health checks should distinguish server readiness, database availability, and transfer-worker readiness.
- **Deployment:** Root Docker configuration builds the server and Torrential separately and includes runtime support for Nginx and archive extraction. Keep ports, persistent volumes, secrets, and library paths configurable for self-hosters.

## 8. Roadmap Boundary

The repository documents the following as planned evolution: GOG and Epic library ingestion via tools such as GOGDL and Legendary; multipart/multidisc installer grouping; seekable-zstd and content-addressed chunk delivery; chunk-level delta patching; peer seeding and pluggable mesh drivers. The diagrams above give those items a coherent target shape while distinguishing them from existing repository components. Update this section and the diagram captions when milestones move from design to implementation.