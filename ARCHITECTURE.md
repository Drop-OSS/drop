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

An adapter is a narrow provider-specific boundary that authenticates, discovers owned products/builds, acquires allowed source assets and reports normalized results. External references include GOGDL/Legendary, `Starkka15/Optima` for Ubisoft Connect, and `ArmchairDevelopers/Maxima` for EA App behavior. These references are reference-only for the in-repo implementations; no code is copied. Evaluate references for provider terms and security assumptions, and do not treat an adapter's success status as proof of verified content.

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
 +----------+-----------+                               |
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

The shared contract module `server/server/utils/adapter/contract.ts` is implemented on `develop`. `stageAdapterRelease` provides duplicate-path pre-checks, centralized path safety, 4 MiB CAS chunking via `DEPOT_CHUNK_SIZE`/`chunkFileToCas`/`createDropletManifest`/`writeDropletManifest`, fail-closed declared-size/digest verification, abort support, and publish-after-verify behavior. Migrating existing adapters onto this module is follow-up work.

#### Disc-set grouping (`server/server/utils/adapter/discset.ts`)

The `feat/disc-set-support` branch adds split-archive detection for `.7z.001` chains, `.partN.rar`, legacy `.rar`/`.rNN`, and generic `.001` splits. It orders parts and checks contiguity/gaps, first/base-part enforcement and duplicate-part rejection; original filenames are retained as provenance.

**Acquisition model note.** GameDepot's adapters stream *raw game data* (individual depot/deployment files) directly from provider CDNs into the depot CAS. We do not download, run, or repackage monolithic installer/setup files when a direct file-streaming path exists. Installer-download-and-extract paths are only a fallback for providers without a manifest/file API, and are treated as staged, validated input — never the primary ingestion mechanism.

### Provider adapter responsibilities

| Candidate | Adapter role | Boundary / caveats |
|---|---|---|
| GOGDL / GOG interfaces | Owned library discovery and supported installers/updates/bonus assets. | Provider-specific API/session code stays isolated; preserve parts and provenance. |
| Legendary / Epic interfaces | Epic library/build discovery and content acquisition. | Normalize manifest/build output; independently validate chunks and assembled files. |
| Optima (`Starkka15/Optima`) | Headless Ubisoft Connect reference for the cleanroom adapter implemented in-repo. | External reference only; no code is copied. The in-repo implementation uses documented UbiServices HTTP endpoints (`public-ubiservices.ubi.com`, `api-uplayv2.ubi.com`, `uplaypc-dns.ubi.com`). Protect account/session state and follow Ubisoft access terms. |
| `YoobieRE/ubisoft-demux-node` (MIT) | Protocol reference for Ubisoft Connect's protobuf Demux API (ownership licenses, download manifests, install runs). | Documentation/reference only, not a dependency. Useful to validate wire-format assumptions and as a fallback acquisition route if the HTTP endpoints change. Reading this MIT-licensed material means the Ubisoft adapter is reference-assisted rather than strictly cleanroom; this is an explicit, documented decision. |
| Maxima (`ArmchairDevelopers/Maxima`) | EA App behavior reference (install records, DIP handshake, launcher launch) for the launcher-based EA content model. | Reference only; no code is copied. The former in-repo DIP acquisition streamer was removed in November 2026: its remote-ZIP premise was never verified against live services, and files now arrive via desktop import of the player's own launcher install. |
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

1. **GOG CDN Content-System Client (`server/server/utils/gog/cdn.ts`)**:
   Communicates directly with GOG Galaxy Content-System / CDN APIs (`cdn.gog.com`, `content-system.gog.com`) using user session tokens. Resolves repository builds, manifests, and file listings for raw, uncompressed game installations.
2. **Direct Game Streamer & CAS Ingest (`server/server/utils/gog/game-streamer.ts`)**:
   Streams the individual actual game files directly from the GOG content delivery network into GameDepot's 4 MiB fixed-window CAS chunk store and emits a canonical `DropletManifest`. Completely bypasses monolithic setup/installer downloads and unpacking when streaming direct depot builds.
3. **GOG CDN Streaming Downloader (`server/server/utils/gog/downloader.ts`)**:
   Streams standalone binary installers (`.exe`, `.bin`, `.sh`) directly into staging with progress callbacks, avoiding in-memory buffer exhaustion, and cleans up partial files on failure.
4. **GOG Installer Extraction (`server/server/utils/gog/extractor.ts`)**:
   Stages installer extraction through `innoextract`, MojoSetup, or archive tools (`7z`, `unzip`, `tar`) using direct argument arrays rather than a shell. Isolates staging and validates path boundaries to prevent traversal attacks. Symlinks are rejected.
5. **Fixed-Size SHA-256 CAS Chunking (`server/server/utils/depot/chunker.ts`)**:
   Reads staged files in fixed 4 MiB chunks, calculates file and chunk SHA-256 digests, and writes immutable raw chunk objects to `depot/objects/{first-two-hex}/{sha256}`. Existing objects are reused to support content deduplication.
6. **Droplet Manifest Builder (`server/server/utils/depot/manifest.ts`)**:
   Sorts normalized relative paths, builds the digest-indexed chunk table, and computes a SHA-256 over canonical JSON (excluding the digest field). Manifest output is atomically renamed into place as `depot/manifests/{manifestSha256}.json`.
7. **GOG Ingest Task Worker (`server/server/tasks/gog/ingest.ts`)**:
   Coordinates extraction, CAS chunking, and manifest publication with progress and status reporting via an injectable job store.

### Phase 2 Epic Games Store Ingestion

Epic Games Store integration streams unpacked game depot files directly from Epic's content delivery network, matching Heroic and Legendary architecture.

```text
User links Epic account (OAuth / exchange token)
        |
        v
Discover user entitlements (`/entitlements/account/{accountId}`)
        |
        v
Resolve product catalog & manifest download URLs (`/launcher/api/public/assets/...`)
        |
        v
Fetch Epic Binary Manifest / file list
        |
        v
Stream raw game files directly to GameDepot CAS (4 MiB SHA-256 chunks)
        |
        v
Emit immutable DropletManifest (`depot/manifests/{sha256}.json`)
```

#### Implemented Epic Games Modules

1. **Epic Games API Client (`server/server/utils/epic/client.ts`)**:
   - Manages OAuth2 token exchanges using client credentials / authorization codes.
   - Discovers owned game entitlements (`getEpicEntitlements`).
   - Resolves deployment assets, active build versions, and signed manifest URLs (`getEpicAssetInfo`).
   - Parses manifest file records and distribution CDN chunk mirrors.
2. **Direct Game Streamer (`server/server/utils/epic/game-streamer.ts`)**:
   - `streamEpicGameToCas()`: Streams game files directly from Epic CDN chunk URLs into GameDepot 4 MiB fixed-window CAS objects (`depot/objects/{prefix}/{sha256}`) and writes an immutable `DropletManifest`.
   - Bypasses monolithic installer files entirely; operates in bounded memory chunks with SHA-256 digest validation and cancellation support.
3. **API Endpoints (`server/server/api/admin/depot/epic/`)**:
   - `library.get.ts`: Retrieves and filters owned Epic entitlements for the authenticated account.
   - `ingest.post.ts`: Dispatches an Epic ingestion job to the ingestion worker with validation for namespace, catalog item ID, and app name.
4. **Epic Ingestion Worker Task (`server/server/tasks/epic/ingest.ts`)**:
   - `ingestEpicJob()`: Coordinates streaming jobs with status lifecycle reporting (`pending` -> `downloading` -> `completed` / `failed`) via an injectable job store interface (`IngestJobStore`).
   - Built-in token resilience: automatically detects upstream `401 Unauthorized` token expiry, rotates credentials via `refreshEpicToken()`, and retries the stream without failing the job.
   - Respects `AbortSignal` for cancellation, ensuring no corrupted manifests or leaked operations.
5. **Epic Integration Testing & Mocking Suite (`server/server/utils/epic/client.test.ts`, `server/server/tasks/epic/ingest.test.ts`)**:
   - Built on Node's native test runner (`node:test`, `node:assert/strict`) without external test runner bloat.
   - Implements hermetic mocking of Epic's OAuth2 token endpoints (`exchangeEpicAuthCode`, `refreshEpicToken`), entitlements directory (`getEpicEntitlements`), and launcher public assets distribution service (`getEpicAssetInfo`).
   - Comprehensive worker task testing verifying state machine progression, token refresh failovers, cancellation via `AbortSignal`, and error quarantine.

### Phase 2 Ubisoft Connect Ingestion (cleanroom, reference-assisted)

Ubisoft Connect integration streams the raw game data files directly from Ubisoft's deployment CDN into the depot CAS. **No installer/setup files are downloaded or executed** — the adapter resolves the install manifest's file records and streams each file's bytes directly, mirroring the GOG/Epic direct-streaming architecture. The implementation was written cleanroom against documented UbiServices behavior, with `Starkka15/Optima` as the architecture reference and `YoobieRE/ubisoft-demux-node` (MIT) consulted as protocol documentation for the Demux surface.

```text
User links Ubisoft Connect account (session ticket)
        |
        v
Discover owned titles (`public-ubiservices.ubi.com/v1/profiles/{userId}/ownedtitles`)
        |
        v
Resolve install manifest (`api-uplayv2.ubi.com/v1/manifests/{version}/{appId}/branches/{branch}`)
        |
        v
Fetch paginated file records (`uplaypc-dns.ubi.com/v1/manifests/{manifestId}/files`)
        |
        v
Stream raw game data files directly to GameDepot CAS (4 MiB SHA-256 chunks)
        |
        v
Emit immutable DropletManifest (`depot/manifests/{sha256}.json`)
```

#### Implemented Ubisoft Connect Modules

1. **Ubisoft Connect API Client (`server/server/utils/ubisoft/client.ts`)**:
   - Session authorize/refresh via `public-ubiservices.ubi.com/v3/profiles/sessions` (`Ubi_v1 t=<ticket>` tickets are never logged).
   - Owned-titles discovery (`getUbisoftOwnedTitles`), product configuration normalization (`getUbisoftConfiguration`), install-manifest resolution (`resolveUbisoftManifest`), and paginated file-record fetching (`fetchUbisoftFileRecords`).
   - File-record output (paths, sizes, sources) is treated as untrusted and re-validated during streaming.
2. **Direct Game Streamer (`server/server/utils/ubisoft/game-streamer.ts`)**:
   - `streamUbisoftGameToCas()`: Streams each manifest file's bytes directly from its CDN source into 4 MiB fixed-window CAS objects and writes an immutable `DropletManifest`.
   - Validates provider-declared lengths, rejects non-HTTPS sources, duplicate paths, and traversal-style paths; bounded memory with cancellation support. No installer files are fetched or run.
3. **API Endpoints (`server/server/api/admin/depot/ubisoft/`)**:
   - `library.get.ts`: Retrieves and filters owned Ubisoft titles for the authenticated account, best-effort resolving display names via product configuration.
   - `ingest.post.ts`: Dispatches an Ubisoft ingestion job with validation for space ID, user ID, and title. The dispatched job payload deliberately carries **no session ticket or credentials**; the ingestion pipeline resolves the account's scoped encrypted ticket from its own credential store when the worker runs.
4. **Ubisoft Ingestion Worker Task (`server/server/tasks/ubisoft/ingest.ts`)**:
   - `ingestUbisoftJob()`: Follows the shared adapter contract with status lifecycle reporting via an injectable `IngestJobStore`.
   - **Ownership re-check before any byte is transferred**: the account must still own the title or the job fails closed (403) without acquiring.
   - One 401 session-refresh retry during manifest/file-record acquisition; respects `AbortSignal` for cancellation.
5. **Ubisoft Testing Suite (`server/server/utils/ubisoft/client.test.ts`, `server/server/tasks/ubisoft/ingest.test.ts`)**:
   - Hermetic `node:test` suites with stubbed `fetch`; no network access. Cover session handling, pagination, ownership enforcement (no download phase may start before ownership confirms), abort-before-execution, missing-manifest and empty-manifest fail-closed paths, and single-retry session refresh.
6. **Caveats / open items**:
   - Ubisoft's HTTP endpoints are undocumented and may drift; `ubisoft-demux-node`'s Demux protobuf schemas are retained as the documented fallback acquisition route.
   - Verification against live Ubisoft services is still outstanding; the hermetic suites validate contract behavior only.

### Phase 2 EA App Content (launcher-based, reference-only)

EA App content follows the launcher-based model instead of a server-side acquisition adapter: players already own the files and their EA App keeps them current, so the desktop client imports those existing installs into the depot and can also play them through the launcher. The files arrive once, from the download the launcher had to perform anyway, and the depot then serves everyone else with delta updates. The former in-repo cleanroom DIP streamer (remote ZIP central-directory parsing and range-based entry acquisition) was removed in November 2026: its ZIP archive premise was never verified against live EA services, EA's own client does not distribute plain ZIPs, and the launcher-based path covers the same need without the unverified protocol surface.

Server-side authentication and discovery are retained unchanged: Nucleus OIDC over plain HTTP to `accounts.ea.com`, EA Help sessions for cookie-backed sign-in, and entitlement/catalog calls on `ecommerce2.dm.origin.com` plus the Juno GraphQL service-aggregation layer at `service-aggregation-layer.juno.ea.com`. They identify what an account owns so titles can be linked in the catalog and matched against desktop imports.

```text
EA App keeps its installs current (the launcher's job)
        |
        v
Desktop detects installs from EA App records
(Windows ProgramData, or inside a umu storefront prefix)
        |
        v
Hash to fixed 4 MiB CAS objects -> upload only what the depot lacks
        |
        v
Commit the release manifest (admin-gated, provenance recorded)
        |
        v
Resync ships the diff after each launcher patch;
everyone else installs and updates from the depot
```

As built (November 2026), the import contract is provider-neutral and lives in two halves. The server half is `server/server/utils/import/session.ts`: `openImportSession` validates the declaration (logical paths, sizes, permission modes, per-chunk digests over the fixed 4 MiB chunking) and answers with the CAS objects it lacks; `storeImportedObject` re-hashes every arriving stream against its declared digest before the object lands; `commitImportSession` requires a complete set, then writes the `gamedepot-droplet` manifest, the provenance record and a Manual `GameVersion` pinned to `casManifestDigest` through `utils/import/db.ts`. Because a chunked version has no folder on disk, `versionPath` is null and disk size reads from the manifest. The routes are desktop-auth client routes under `api/v1/client/depot/import/session`, gated on the account's admin flag rather than on system ACLs, because a desktop session authenticates as a client JWT. The desktop half is the `importer` crate: `scan.rs` reproduces the server's chunking byte-for-byte (pinned by tests on both sides), and `engine.rs` runs declare → upload-the-diff → commit with bounded concurrency, per-object retry and cancellation.

Detection is a thin per-launcher recipe on top of that engine, in `desktop/src-tauri/importer/src/recipes/`: each storefront answers the same question - which folders hold its installs - from the files it wrote, whether that is the EA app's INI records, Steam's `libraryfolders.vdf`, Ubisoft Connect's settings YAML, Epic's per-game `.item` manifests, or GOG's and Rockstar's conventional roots, and every drive letter resolves through the prefix's own drive links, so a umu or Wine storefront prefix and a real Windows install are the same search. A folder is an install only if it contains a non-redistributable executable, and a detected install only ever prefills the import form - the publish decision stays with the admin pressing the button.

The same detection answers the second half of the model, play: each install records the entry point the recipe found and the prefix that holds it, and the desktop runs that copy where it lies - natively on Windows, through umu-run and Proton on Linux, in the storefront's own prefix when the install was found in one (`desktop/src-tauri/src/launcher_play.rs`) - and files the session's playtime under the catalog game the title matches. No second copy is made: the file-owner player and the depot's downloader share the economy the launcher already paid for. Steam is the one row whose honest Play is not an exec: detection reads the library's `appmanifest_<appid>.acf` records, so a detected Steam install knows its app id, and when this machine's native client owns that id (its own manifest, a file-only check) Play and Stop are the client's own `steam://run` and `steam://stop` - Steamworks content wants its client up, and the client is the one process that knows how to start and stop its own games.

An Epic depot copy also carries the record Epic's own tools look for. At install completion, a release catalogued as `epic-<appid>` gets the install manifest the launcher would have written - a `.item` file naming the app id and a conventional `Program Files/Epic Games` location, inside the `ProgramData/Epic/EpicGamesLauncher/Data` layout, in the game's own umu prefix - with a symlink from that Windows path to the real install directory so the record describes content living anywhere on the Linux filesystem (`desktop/src-tauri/games/src/epic_seed.rs`, the Heroic/Lutris pattern for sideloads). The seed is best-effort by design: the bootstrapper that consults it is the reason it exists, but an install is complete with or without it, and the same helper will seed the shared storefront prefix when scripted handoff arrives.

Providers divide by who keeps a release current. **Node-owned** - GOG, Epic, Ubisoft Connect: the server's acquisition adapters pull build content from the provider CDN, the depot copy is what everyone installs, and it plays through Drop's own launch path with no storefront installed anywhere. Freshness is the node's job too: `api/admin/depot/{gog,ubisoft}/check-updates` asks the stored connection what the account is entitled to now, and because the acquisition names each imported version with the provider's own build identity (GOG's `versionName`, Ubisoft's deploy manifest SHA-1) recorded on the `gog-<id>` / `ubi-<id>` catalog row, the check is that identity compared against the newest entitled build - `utils/depot/update-check.ts` holds the pure diff and the catalog scan, and a newer build is queued through `utils/depot/ingest-queue.ts`, the very task pipeline the admin button uses. The scan itself lives in `utils/depot/update-scan.ts` and answers from two doors: the admin route and the daily `depot:check-updates` scheduled task, so the button is "check me now" over the same code the calendar runs by itself - a provider with no stored connection is a skip, not a failure. Titles owned but never acquired are reported, never fetched. (Epic's checker waits on its acquisition decoder; the entitlements and library calls are already there.) **Launcher-owned** - EA and Rockstar, plus Steam, whose content is not obtainable without its client: there is no server-side acquisition to keep current, so the player's launcher install is the file source, import and Resync move it into the depot, and Play runs that copy directly. The desktop states the same division on each detected row: node-owned providers offer Upload (the copy seeds a depot release the node will update itself), launcher-owned ones offer Resync (their launcher copy is the ongoing update path).

How a release starts is recorded with it, not guessed at launch: `GameVersion.runsStandalone` says whether the build runs on its own (true: DRM-free, anonymous-EOS, self-starting) or only with its store client authenticating (false: legit EA, Rockstar, Ubisoft and Steam builds). It is declared, never detected - an imported release carries it from the open-session call, where the import form defaults it per launcher and the admin corrects it for the bytes in front of them, and admin-published versions carry it the same way; it syncs inside the version document (whose `versionPath` the desktop model now treats as optional, since chunk-store versions have never had one). The launch path consults it: direct exec refuses a false build with `ProcessError::StoreClientRequired` rather than letting a DRM refusal surface as a failed start, while Play of the launcher's own detected copy stays flag-free because those files run direct whatever the version says. The storefront runner that plays false builds through their client is the next piece of the model; until then the refusal names its reason.

#### Retained EA App Modules (`server/server/utils/ea/`)

1. **EA API Client (`client.ts`)**:
   - Nucleus OIDC authentication and entitlement/discovery calls.
   - Keep credentials, tokens and signed URLs scoped and redacted; treat provider responses as untrusted.
2. **Entitlement Discovery (`library.ts`)**:
   - Normalizes owned titles (live nested and flat entitlement layouts, EA Play player-shell listings, optional Juno catalog search) into discovery rows carrying id, title and offer id for catalog identity matching.
   - The per-entitlement `downloadLink` field went out with the removed ingestion path.

Live EA services (Nucleus, ecommerce2 and Juno) are unverified; hermetic `node:test` suites validate contract behavior only.

Maxima reference: [`ArmchairDevelopers/Maxima`](https://github.com/ArmchairDevelopers/Maxima), specifically `maxima-lib/src/content/downloader.rs`, `manager.rs`, `dip.rs` and `endpoints.rs`. Reference only for EA App launcher behavior; no source code is copied.

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

Planned evolution includes headless GOG/Epic/Ubisoft App ingestion; a launcher-based EA App content model (the former DIP streamer is removed; content arrives by importing the player's own launcher installs, with play handed to the launcher where a second copy would be waste); a provider-neutral manifest/chunk depot informed by Steam-style DepotDownloader patterns; seekable-zstd packaging and delta updates; and optional UMU/Proton launch on Linux/Steam Deck. Ubisoft Connect ingestion is implemented on `develop` (cleanroom, reference-assisted by the MIT-licensed `ubisoft-demux-node` protocol schemas; Optima remains reference-only); a Demux-socket fallback acquisition route is retained as a documented contingency if the HTTP endpoints drift. Mesh delivery and these external integrations should be marked implemented only after corresponding code, tests and security/operational controls exist. Update this document and the roadmap as each milestone changes status.
