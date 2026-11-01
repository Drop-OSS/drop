# GameDepot Architecture

> **Implementation status (updated 2026-11-01).** The server now contains a local GOG installer staging/extraction utility, fixed-size SHA-256 CAS chunking, canonical DropletManifest generation, and an injectable ingestion executor. This is the packaging half of ingestion: a provider-authenticated GOG acquisition/download client, concrete Prisma `GameImportJob` model/store, task registration/queue, and end-to-end CI coverage are not included in this implementation and must be wired before claiming unattended live GOG acquisition.

## GOG acquisition and depot ingestion (implemented utilities)

`server/server/utils/gog/extractor.ts` stages installer extraction through locally installed `innoextract`, Mojo, or archive tools (`7z`, `unzip`, `tar`) using argument arrays rather than a shell. Extraction tools must be provisioned in the worker image. Treat archives as untrusted; staging is isolated, and downstream ingestion rejects symlinks. Archive traversal behavior still depends on the selected external tool and must be constrained in production.

`server/server/utils/depot/chunker.ts` reads files in fixed 4 MiB chunks, computes file and chunk SHA-256 digests, and writes immutable raw chunk objects to `depot/objects/{first-two-hex}/{sha256}`. Existing objects are reused. `server/server/utils/depot/manifest.ts` sorts normalized relative paths, builds the digest-indexed chunk table and computes a SHA-256 over canonical JSON (excluding the digest field). Manifest output is atomically renamed into place. This format is version 1, GameDepot-owned; it is not a provider-signed manifest.

`server/server/tasks/gog/ingest.ts` exposes `ingestGogJob` for a task/queue integration to call. It extracts supplied local installer paths, chunks the staged files, publishes a manifest, and updates status/progress through an injected store interface with optional progress events. Persistence and scheduling are deliberately adapters: implement a Prisma-backed store consistent with the application's actual schema and durable task runner before production use. The included chunk output is raw fixed-size CAS; seekable-Zstandard encoding/index generation and HTTP/CDN delivery are not yet implemented.

Operational requirements: provision and pin extractor executables; use isolated, quota-limited staging; apply archive entry/size/path limits; provide idempotent job claiming and retries; persist progress without flooding the database; authorize source acquisition and object publication; and verify a manifest and referenced objects before exposing a release. Do not log provider credentials or signed URLs. Acquiring or distributing game files remains subject to provider terms and applicable law.

## Existing repository boundaries and target integrations

GameDepot is a monorepo. `server/` is a Nuxt control-plane application, `desktop/` is the native client, `torrential/` is the Rust transfer service, and shared contracts reside in `libraries/` and `packages/`. Control-plane metadata and high-volume bytes should remain separated. UMU/Proton is a launch-layer integration, independent of ingestion.

The wider design target is `authorize -> discover -> normalize -> acquire -> verify -> publish`. GOG/Epic/other adapters must preserve provider IDs and source provenance, stage partial files separately, validate ordered split archives, and publish atomically only after integrity checks. Store adapters do not bypass DRM or grant redistribution rights.

## Depot and transfer design

A provider-neutral immutable manifest maps safe logical paths, lengths and SHA-256 digests to ordered chunk objects. Object identity is content digest, not filename. Bound concurrency, memory/disk use, retries and paths. Reject traversal and unsafe links. Reuse only integrity-verified objects; assemble to staging and verify final files before atomic installation. Delta updates compare verified manifest identities and retain the previous installation until the replacement is valid.

Seekable Zstandard packaging, range delivery, delta transfer and mesh sources remain future work. Future compressed representations must define frame boundaries and a validated seek index, with compressed and decoded integrity checks; compression metadata is not a trusted hash.

## Trust and roadmap boundary

Authorize private releases, manifests and objects. Keep tokens server-side and redact secrets. Treat source metadata, archives and paths as untrusted; quarantine failed imports, and reconcile interrupted jobs. External tools must be pinned, verified and reviewed for licensing/provider terms. Update this status only when real worker registration, provider acquisition, persistence, tests and production safeguards are present.
