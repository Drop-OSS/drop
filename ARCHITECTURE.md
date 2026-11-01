# GameDepot Architecture

> **Status and scope.** This document distinguishes current repository boundaries from target integrations. Store adapters, manifest/chunk repackaging, mesh delivery, and UMU/Proton launch integration are design targets unless implemented and verified in code. External projects cited here are references or candidate adapters, not bundled dependencies or implied endorsements. Store access and distribution must follow provider terms and applicable law.

## 1. System Component Overview

GameDepot is a self-hosted game library and distribution monorepo. Checked-in components include a web/server application, a native desktop client, the Rust transfer service `torrential` (including a `droplet` module), and shared libraries/packages. The server owns user-facing APIs, authorization and catalog metadata; the transfer service handles data-plane jobs; the desktop client coordinates local installations and process launch.

```text
 Users / Desktop / Steam Deck
             | HTTPS / authenticated API       | local launch contract
             v                                 v
 +------------------------+           +--------------------------+
 | Server control plane   |           | Desktop client / Tauri   |
 | auth, catalog, jobs,   |           | install manager, runner  |
 | manifests, adapter jobs|           | selection, process       |
 +-----------+------------+           +------------+-------------+
             |                                         |
     metadata / job control                    local verified files
             v                                         v
 +------------------------+           +--------------------------+
 | PostgreSQL / metadata  |           | UMU / Proton / Wine*     |
 +------------------------+           +--------------------------+
             | transfer request
             v
 +------------------------+
 | Torrential / droplet   | ---> object store / CDN / cache
 | bounded transfer work  |       (future mesh sources)
 +------------------------+
```

`*` UMU/Proton is a planned execution-layer integration, not an ingestion mechanism. A game can be acquired by any supported adapter and launched through a compatible runner independently.

### Repository boundaries

| Area | Responsibility |
|---|---|
| `server/` | Nuxt application, API/routes, auth, catalog, orchestration and persistence. |
| `desktop/` | Tauri client and Rust crates for client, database, download management, games/process, remote access and cloud saves. |
| `torrential/` | Rust transfer service and related `droplet` modules; data-plane operations. |
| `libraries/`, `packages/` | Shared contracts/models. Prefer shared manifest, adapter-job and launch types instead of parallel wire formats. |
| Root deployment | Container/build configuration for server and transfer runtime; secrets and persistent library paths are deployment configuration. |

Keep control-plane metadata and high-volume bytes separate. Current repository components should not be confused with planned provider adapters or future object-store formats.

## 2. Store Ingestion: Adapter Contract

An adapter is a narrow provider-specific boundary that authenticates, discovers owned products/builds, acquires allowed source assets and reports normalized results. Candidate references include GOGDL/Legendary, `Starkka15/Optima` for Ubisoft Connect, and `ArmchairDevelopers/Maxima` for EA Desktop. These tools are external projects; evaluate their maintenance, licenses, provider terms, security posture and invocation requirements before adoption. Do not treat any adapter's success status as proof of verified content.

```text
 Account link / authorization
             |
             v
 +----------------------+      encrypted, scoped secrets
 | Provider adapter     |<-------------------------------+
 | GOG / Epic / Ubisoft |                                |
 | EA / manual import   |                                |
 +----------+-----------+                                |
            | provider IDs, build metadata, source bytes |
            v                                            |
 +----------------------+                               |
 | Normalize / provenance|                               |
 | stable GameDepot IDs  |                               |
 +----------+-----------+                                |
            |                                            |
            v                                            |
 +----------------------+       +-----------------------+
 | Staging / resumable  |------>| Validate, group parts |
 | temporary downloads |       | size/hash/order       |
 +----------+-----------+       +-----------+-----------+
            |                               |
            +---------------+---------------+
                            v
                 +--------------------------+
                 | Immutable release record |
                 | manifest + source lineage|
                 +--------------------------+
```

The shared contract is `authorize -> discover -> normalize -> acquire -> verify -> publish`. Use idempotent reconciliation; normalize provider product, edition, build, DLC, language and platform identifiers while retaining provider IDs as provenance. Keep OAuth/session state scoped and encrypted; redact credentials, tokens, cookies and signed URLs from logs. Adapter output remains untrusted until content checks complete. Stage partial downloads separately; handle expiring URLs, retries, range support and rate limits. Represent split archives/discs as one logical release with explicit order and completeness checks. Publish only after required metadata and bytes validate, atomically updating catalog availability.

### Provider adapter responsibilities

| Candidate | Adapter role | Boundary / caveats |
|---|---|---|
| GOGDL / GOG interfaces | Owned library discovery and supported installers/updates/bonus assets. | Provider-specific API/session code stays isolated; preserve parts and provenance. |
| Legendary / Epic interfaces | Epic library/build discovery and content acquisition. | Normalize manifest/build output; independently validate chunks and assembled files. |
| Optima (`Starkka15/Optima`) | Candidate headless Ubisoft Connect ingestion implementation. | External/version-pinned adapter; protect account/session state and follow Ubisoft access terms. Map products/builds to common catalog, not provider-specific public APIs. |
| Maxima (`ArmchairDevelopers/Maxima`) | Candidate headless EA Desktop ingestion implementation. | External/version-pinned adapter; isolate EA authorization/session handling and independently validate acquired assets. |
| Manual import | User-provided installer/assets and metadata. | Same staging, path safety, grouping, validation and publication gates. |

These adapters describe ingestion of authorized assets; they do not bypass DRM or grant rights to redistribute content. Prefer supported interfaces and make account authorization and legal responsibility explicit.

### Phase 2 GOG acquisition worker

The GOG worker is a provider-specific ingestion adapter behind the shared `authorize -> discover -> normalize -> acquire -> verify -> publish` contract. It is an architectural target, not an assertion that the server currently has a registered worker implementation. Keep GOG session/API details inside the adapter; the control plane should enqueue an account-scoped product/build job and receive normalized metadata, staged asset references, progress and typed failure state—not provider credentials or raw signed URLs.

```text
User links GOG account
        |
        v
Scoped credential store -> enqueue idempotent acquisition job
                                  |
                                  v
                       GOG worker claims job
                       | refresh/validate auth
                       | discover owned product + build
                       | resolve language/platform files
                       v
                    bounded downloads
                    (retry / resume / rate limit)
                       |
                       v
          isolated staging + part/order metadata
                       |
                       v
        validate paths, sizes, hashes, completeness
                       |
                       v
      normalize release + immutable source provenance
                       |
                       v
        depot chunking/manifest -> atomic publish
                       |
                       v
              job result / catalog status
```

Worker safeguards: deduplicate by account, product, build and requested variant; persist job state so restart can resume only after revalidating partial bytes; cap parallel products/files/chunks and temporary disk use; use bounded backoff for transient network/API failures and stop on authorization, policy or integrity failures. Keep multipart installers as ordered logical assets and do not mark a release available until every required part and manifest entry passes verification. Redact tokens, cookies and expiring URLs from progress, errors and logs; store only scoped encrypted credentials. Support cancellation and distinguish discovery, authentication, transfer, verification and publication status.

#### Implemented GOG & Depot Ingestion Modules

As of Phase 2 implementation on `develop`:

1. **GOG CDN Streaming Downloader (`server/server/utils/gog/downloader.ts`)**:
   Streams binary installers (`.exe`, `.bin`, `.sh`) directly into staging with progress callbacks, avoiding in-memory buffer exhaustion, and cleans up partial files on failure.
2. **GOG Installer Extraction (`server/server/utils/gog/extractor.ts`)**:
   Stages installer extraction through `innoextract`, MojoSetup, or archive tools (`7z`, `unzip`, `tar`) using direct argument arrays rather than a shell. Isolates staging and validates path boundaries to prevent traversal attacks. Symlinks are rejected.
3. **Fixed-Size SHA-256 CAS Chunking (`server/server/utils/depot/chunker.ts`)**:
   Reads staged files in fixed 4 MiB chunks, calculates file and chunk SHA-256 digests, and writes immutable raw chunk objects to `depot/objects/{first-two-hex}/{sha256}`. Existing objects are reused to support content deduplication.
4. **Droplet Manifest Builder (`server/server/utils/depot/manifest.ts`)**:
   Sorts normalized relative paths, builds the digest-indexed chunk table, and computes a SHA-256 over canonical JSON (excluding the digest field). Manifest output is atomically renamed into place as `depot/manifests/{manifestSha256}.json`.
5. **GOG Ingest Task Worker (`server/server/tasks/gog/ingest.ts`)**:
   Coordinates extraction, CAS chunking, and manifest publication with progress and status reporting via an injectable job store.

## 3. Manifest-Driven Depot and Chunk Delivery

DepotDownloader provides a useful reference for Steam-style depot/build manifests and chunk-based acquisition/assembly. GameDepot should adopt the general pattern—not assume access to Steam's private protocol, manifests, services or credentials. Define its own versioned, provider-neutral manifest schema. It should describe immutable release identity, logical file paths, sizes and digests, ordered chunk/object references and integrity metadata; where a provider manifest is available, retain its ID and source provenance.

```text
Provider metadata/build manifest or staged files
                         |
                         v
       Parse & normalize into GameDepot manifest
                         |
        +----------------+-----------------+
        |                                  |
        v                                  v
 logical file map                 chunk/object index
 path, length, digest             id, offset, size, digest
        |                                  |
        +----------------+-----------------+
                         v
                 immutable release
                         |
             authorized transfer request
                         v
       concurrent bounded chunk retrieval/cache
                         |
                verify each object
                         |
             assemble into staging files
                         |
             verify final file digest
                         v
                 atomic publish/install
```

Separate three identities: the provider's source manifest/build ID, GameDepot's immutable release manifest ID, and content-object identity/digest. Chunks are reusable only when identity and integrity checks match; do not infer equality from filename or size alone. Support resumability only when partial state can be revalidated. Bound worker count, memory, disk use, retry rates and path lengths. Reject traversal, unsafe links, duplicate/conflicting paths and malformed offsets. Cache verified objects by digest and garbage-collect only when no live manifest or job references them.

### Ingestion-to-depot chunking boundary

Zstandard depot chunking happens only after provider bytes have been acquired into staging and validated. It is a GameDepot packaging operation; do not assume GOG's download chunks are zstd frames or reuse provider chunk hashes as depot object identities.

```text
GOG resolved files -> staged bytes -> source size/hash verification
                                              |
                                              v
                                logical file / part normalization
                                              |
                                              v
                          fixed policy chunking + independent zstd frames
                                              |
                              +---------------+---------------+
                              |                               |
                              v                               v
                    content digest/object              versioned index
                    (compressed + plain)       (file offsets, frame ranges)
                              |                               |
                              +---------------+---------------+
                                              v
                             immutable release manifest
                                              |
                                              v
                                 atomic catalog publication
```

Use a versioned, deterministic chunking policy and record codec parameters, uncompressed/compressed lengths, offsets and cryptographic digests in the depot manifest. Verify each generated frame and the reconstructed logical file against the staged source before publication. Keep source-provider provenance distinct from depot object identity and release-manifest identity. A changed chunk layout produces a new immutable manifest; unreferenced objects can be garbage-collected only after active jobs/releases no longer reference them.

### Seekable zstd representation

Seekable Zstandard is a GameDepot packaging target, not an assumed property of provider chunks. After acquisition and verification, a pack/index stage may create independently decodable zstd frames. A versioned index maps logical file offsets to frame IDs and compressed byte ranges and declares sizes/digests. A reader resolves a logical range, fetches only indexed ranges from range-capable storage, validates bounds and compressed/decoded integrity, then decodes the requested frames. Keep concurrency and buffering bounded; publish a new immutable manifest when content/layout changes. Preserve original verified files or a reproducible source relationship when needed for revalidation.

HTTP range support, manifest validation, chunk cache and final-file verification are independent stages. Do not treat compression framing or a provider's chunk layout as a trusted hash. Delta updates compare prior and target manifests, reuse unchanged verified objects and fetch only absent/changed chunks; keep the previous installation active until target files pass validation and the install pointer can switch atomically.

## 4. Transfer Engine: Torrential / droplet

Torrential is the Rust transfer/data-plane boundary. A manifest-aware evolution should keep source selection independent from scheduling, verification and assembly. Depot/CDN is the initial source; local cache and future authorized mesh peers may implement the same source contract.

```text
Server authorization + immutable manifest
                    |
                    v
          Transfer job / scheduler
                    |
       +------------+-------------+
       |                          |
       v                          v
 depot/CDN worker           future peer/cache worker
       |                          |
       +------------+-------------+
                    v
     bounded queue -> verify object -> cache
                    |
                    v
       assemble/decode to temporary target
                    |
          verify final file / cancel-safe
                    |
             atomic finalize + status
```

Expose cancellation, resumability, bounded concurrency, progress, typed failures and retry policy independent of source. Never publish partial or unchecked bytes. Report job IDs and verification failures without logging credentials or signed URLs. Future mesh sources must honor authorization and verify the exact same object digests as CDN sources.

## 5. Linux / Steam Deck Execution Layer (umu-launcher)

UMU (umu-launcher, Open-Wine-Components) is a reference Proton execution layer for running Windows games on Linux, including SteamOS-class environments. The proposed integration belongs in the desktop client's process/runner boundary after installation, not in server-side store ingestion or content verification. Treat UMU as an optional external runtime that must be discovered/configured and whose version/availability is reported; do not silently download or replace runners without user consent.

```text
GameDepot catalog/install record
              |
              v
per-title launch configuration
executable, args, working dir, env
runner choice, prefix identity
              |
              v
platform launch provider
  Windows native | Linux native | UMU/Proton (planned)
              |
              v
process lifecycle -> exit status / logs / play state
```

A provider-neutral launch request should carry executable path, arguments, working directory, scoped environment, compatibility runner selection and per-game prefix identity. Linux/Steam Deck support resolves the UMU/Proton runtime and prefix without conflating GameDepot's library identity with a particular runner. Keep prefixes isolated per title/profile unless configured otherwise; avoid leaking store tokens into the game process. Handle paths with spaces, cancellation, process exit/status, logging and runtime errors. Compatibility is title-, runner- and system-dependent: expose user overrides and clear diagnostics rather than claiming universal support. Proton/UMU launch support does not establish that a title is DRM-free, compatible, or lawfully redistributable.

## 6. Trust, Persistence, Operations

- **Auth:** Authorize every private catalog, release, manifest and object request. Scope temporary URLs and keep provider credentials out of client-visible state.
- **Metadata vs bytes:** Persist account links, catalog records, immutable manifests and job state in configured metadata storage; keep bulk bytes in library/object storage. Map content identities to physical locations separately.
- **Safe publication:** Stage, validate and then atomically publish metadata/files. Quarantine failures; reconcile interrupted jobs after restart.
- **Input safety:** Treat provider manifests, archives, paths, offsets and adapter output as untrusted. Enforce archive/path/resource limits and reject traversal and unsafe links.
- **Execution safety:** Launch games as the user, with explicit executable/arguments and minimal scoped environment. Never interpolate untrusted metadata into a shell command; avoid privileged runner execution and redact secrets from child-process logs.
- **Operations:** Correlate adapter, transfer and launch jobs with stable IDs; track phase/progress/retries/errors. Distinguish server, database and worker readiness.
- **External dependencies:** Pin or constrain supported tool versions, verify binaries/sources, review licenses/provider terms and fail closed when an adapter/runtime is unavailable.

## 7. Roadmap Boundary

Planned evolution includes headless GOG/Epic ingestion; candidate Ubisoft Connect (Optima) and EA Desktop (Maxima) adapters; a provider-neutral manifest/chunk depot informed by Steam-style DepotDownloader patterns; seekable-zstd packaging and delta updates; and optional UMU/Proton launch on Linux/Steam Deck. Mesh delivery and these external integrations should be marked implemented only after corresponding code, tests and security/operational controls exist. Update this document and the roadmap as each milestone changes status.
