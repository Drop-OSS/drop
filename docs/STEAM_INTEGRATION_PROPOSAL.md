# Steam Integration Proposal

> **Status:** Architecture and staged implementation proposal only. No Steam support is asserted to be implemented. This proposal is intentionally account-local: it does not turn a Steam user's purchased library into a GameDepot redistribution source. Provider access, content rights and any operational deployment must be reviewed against current Valve/Steam and applicable third-party terms. This is not legal advice.

## 1. Goals and non-goals

### Goals

- Let a user associate a Steam AppID with GameDepot catalog metadata and optionally launch an already installed Steam title through Steam.
- Offer an opt-in, user-local ingestion adapter for content the signed-in account is entitled to access, only if a legal/terms review authorizes the exact flow.
- Reuse GameDepot's `authorize -> discover -> normalize -> acquire -> verify -> publish` adapter pipeline without putting Steam protocol details into shared catalog APIs.
- Offer optional SteamGridDB artwork and Steam Deck/Steam client shortcuts for GameDepot-managed installs.

### Non-goals

- Bypassing Steam entitlement, access controls, DRM, Steam Guard, manifest access checks, or game-specific protections.
- Downloading restricted files with anonymous access, depot keys obtained from third parties, leaked credentials/manifests, or unauthorized access tokens.
- Replacing the Steam client for Steamworks authentication, multiplayer, achievements, cloud saves, or other services.
- Hosting, seeding, caching for other users, or redistributing Steam game files by default. User possession of files or entitlement to play is not in itself a grant to redistribute them.

## 2. Recommended product boundary: three modes

1. **Steam catalog / launch link (MVP):** Store AppID and public Store metadata; user can launch via the locally installed Steam client (`steam://run/<appid>` or equivalent client invocation). GameDepot does not download these files and does not require Steam credentials. Ownership/private library visibility is not inferred from public store metadata.
2. **Non-Steam shortcut (MVP optional):** Register a GameDepot-installed, user-authorized executable in the local Steam library to expose it in Big Picture/Game Mode and enable Steam Input/controller/overlay where supported. A shortcut is a launcher entry, not Steam ownership or a Steam license. Launch target may be GameDepot itself or UMU for compatible games.
3. **Account-authorized depot ingestion (later, gated):** Optional local adapter for users who explicitly request acquiring their entitled content. Proceed only after a written legal/security/Valve-terms review, a supported access path and a product decision that permits storing the resulting bits. Keep acquisition local to the user's configured library unless separate written distribution rights exist. Do not enable any server-side shared library, peer seeding, public release, or multi-user transfer for this provider absent those rights.

Default behavior must be modes 1 and optionally 2. Keep the ingestion feature behind a disabled-by-default capability/feature flag until its review gate passes.

## 3. Proposed architecture and data contracts

```text
Desktop (Steam link / optional local account flow)
     | AppID, explicit user action, short-lived job status
     v
Server control plane: catalog metadata + capability policy
     |                         \
     | public metadata           \ opt-in account-local work only
     v                            v
Steam Store metadata      Local adapter broker (preferred)
SteamGridDB artwork       DepotDownloader process (first candidate)
     |                            |
     +---- normalized metadata    +--> user's staging directory
                                      --> verify/scan/manifest locally
                                      --> user-owned install only
Desktop launch provider <--- local install record / Steam shortcut
     |                    Steam client or UMU/Proton (independent)
     v
Game process
```

Add a provider-neutral catalog record with optional `store = steam`, `appId` (uint32), display name, metadata/artwork provenance and URLs, and timestamps. Preserve the distinction between a catalog product and an installation. If ingestion is approved, record provider app/build/depot/manifest identifiers, requested OS/architecture/language/branch, account-link reference (never credentials), acquisition time, provenance, validation results and local storage scope. Keep secrets in OS keyring or equivalent encrypted secret storage, never in Prisma/plaintext config, logs, CLI arguments, environment dumps, game process environment or manifests.

Use a separate optional `SteamAccountLink` state machine (`unlinked`, `authorization_pending`, `linked`, `reauth_required`, `revoked`, `error`) that retains only the minimum token/session material strictly required by an approved adapter. Provide disconnect and local secret deletion. The initial iteration should avoid a server account link altogether: broker authentication and credentials locally on the desktop and keep downloaded data on the same user's storage. Never have a multi-tenant server collect Steam passwords or authenticator secrets.

Jobs should be typed and cancellable: `resolve_app`, `metadata_refresh`, `artwork_fetch`, `authorize_local`, `resolve_depots`, `download`, `verify`, `register_shortcut`. Expose phase/progress/error codes, not provider secrets or signed URLs. Make retries idempotent and bound network, memory, disk, parallelism, file counts and staging retention.

## 4. Ingestion mechanics and ID resolution

### Tool choice

- **DepotDownloader (recommended initial adapter candidate):** A separately version-pinned executable invoked behind a narrow local adapter contract. It uses SteamKit2 and documents `-app`, optional `-depot`, `-manifest`, OS/language/branch selection, manifest-only output, chunk downloads and validation. Prefer its maintained upstream build after review; do not use unofficial forks that offer depot-key injection, manifest-code bypasses or other access-control circumvention. Do not bundle it until license, binary provenance, update strategy and terms are reviewed. Use an isolated working directory, restricted permissions, bounded resource limits and a machine-readable wrapper. Do not shell-interpolate user-controlled values.
- **SteamKit2 direct integration:** Consider only if the external process boundary materially limits supported functionality and GameDepot can maintain .NET runtime/dependency security. It is a protocol/library implementation option, not a Valve-supported guarantee or authorization mechanism. Keep Steam-specific protocol handling in the adapter crate/service.
- **SteamCMD:** Valve's command-line client is primarily useful for anonymous/public content and server/tool downloads where offered, and for explicit supported workflows. It does not promise entitlement to arbitrary retail game depots; access can vary by account, app, branch and platform. Steam Guard may require interactive authorization and cached login state. Treat SteamCMD config/cache as sensitive account tokens, not ordinary generated data. Don't make headless unattended acquisition a requirement or suggest bypasses for authorization prompts.

### Authentication

Anonymous access is usable only for content Valve makes anonymously available (commonly server tools or public depots); it is not a mechanism to fetch a user's private library. For entitled content, the account holder must complete Valve's supported login/Steam Guard verification. Prefer a QR/device approval flow when the chosen maintained client supports it; render the challenge locally, display the Steam account/device approval context, expire it promptly and require an explicit user action. Otherwise prompt for credentials only in a trusted local UI, never send passwords to GameDepot's server, and handle Steam Guard email/mobile codes or approval as interactive callbacks. Never store or request a user's Steam Mobile Authenticator shared secret/recovery code. If a session token is retained, require explicit opt-in, OS-protected storage, minimal scope/lifetime, revocation and deletion controls. Reauthentication failure should pause and request user action rather than loop or attempt workarounds. Never log password, QR URL/token, 2FA code, refresh/access token, session cookie or command line containing them.

### AppID / DepotID / ManifestID

- AppID identifies the Steam application, not ownership, entitlement, game files or a unique GameDepot release.
- Resolve the app's available depots/build branches and platform/language mapping from authorized Steam app/build metadata. Keep DLC/app packages distinct; don't assume one app maps to one depot.
- DepotID is scoped to an app's content layout and can represent platform-, language-, shared- or DLC-specific content. Resolve allowed depots for the user's selected OS/architecture/language and entitlement; show the selection before download.
- ManifestID selects a specific depot manifest/build snapshot. Resolve current branch/build manifests from authorized metadata. Download historic manifests only when Steam authorizes that account to access them. Treat community posts, SteamDB records, leaked manifest IDs and third-party indexes as untrusted hints, never as entitlement, depot decryption keys or proof of download rights.
- Record source app/build/depot/manifest IDs and all selected options as provenance. Keep them separate from GameDepot's own immutable release ID and content digests. Check Steam-provided integrity data during transfer, then compute GameDepot digests and verify assembled file sizes/content before local atomic install. Provider hashes are not proof of legal entitlement or rights to redistribute.

Any adapter failure stating unavailable manifest, missing access code, 401/403, missing depot key or ownership should fail closed. Do not offer fields for importing third-party depot keys or implement requests designed to bypass Steam's access rules.

## 5. DRM and compatibility policy

Steam distribution can include Steamworks API features, Steamworks DRM/SteamStub, publisher DRM, launchers, online checks or other title-specific requirements. UMU/Proton compatibility is separate from acquisition and says nothing about DRM state. GameDepot will download and preserve bytes as provided, not modify executables, strip SteamStub, substitute Steam API DLLs, patch DRM, emulate Steamworks, spoof ownership or provide instructions/integration for doing so. Goldberg emulator compatibility is explicitly out of scope: do not bundle it, automate its installation/configuration, or recommend it as an acquisition/DRM workaround. If a user-authorized install fails to launch without Steam or online entitlement validation, provide a clear diagnostic and launch the Steam client if appropriate; do not promise offline/DRM-free behavior. Support known DRM-free releases only when independently documented by the rights holder and still subject to applicable permissions.

## 6. Metadata and artwork

- **Steam Store data:** Use public Steam Store app details/store data for non-sensitive metadata (title, description, supported OS, release date, categories, screenshots, official capsule/header assets). Steam Web API/store interfaces have distinct availability, key requirements and terms; select a currently documented endpoint, cache responsibly, rate-limit, observe attribution/display rules and terms, and tolerate missing/localized/stale data. Metadata is not an ownership lookup. Never scrape private libraries or ask for Steam passwords to retrieve metadata.
- **Steam Web API:** Keep any API key on a trusted server only where the documented endpoint actually requires one and terms permit the use; never ship a Valve key in desktop bundles or public repos. Do not assume partner/publisher-only endpoints are available to GameDepot. Avoid features requiring private publisher API access.
- **SteamGridDB:** Optional community artwork provider for grid/capsule, hero, logo and icon. User supplies their own key in settings and it is stored in an OS secret store (or use a server-side key only under permitted terms, not a public client constant). Search by Steam AppID first, then title with user confirmation to avoid wrong-game matches. Cache images with attribution/source/license metadata and obey current SteamGridDB API, image and rate-limit terms. Failure or missing key must not block catalog/launch features.
- **Community manifests:** Treat community-posted manifests/IDs as untrusted metadata only. They can be stale, incorrect or associated with restricted/deleted builds and don't grant access. Do not host or distribute manifest files, depot keys, encrypted/decrypted content, account tokens or instructions for obtaining them without explicit rights and terms review. Prefer official/authorized metadata and preserve its provenance.

## 7. Steam client and Steam Deck launching

For a genuine Steam game, prefer asking the local Steam client to run the AppID; do not duplicate its content acquisition/update or license validation. For a GameDepot-managed executable, offer an optional Non-Steam shortcut so Steam can provide the user-selected overlay/controller/Game Mode path where supported. Shortcut creation is a local opt-in presentation integration; it does not import the game into Steam as a licensed Steam title.

Steam shortcuts are represented in user-specific binary `shortcuts.vdf` under Steam userdata and the format/location can vary. Implement only after testing on supported Steam/SteamOS versions. Use a maintained binary VDF parser/writer; never edit by regex. Discover the active Steam installation/user rather than hardcoding paths. Back up and parse existing entries, upsert by stable GameDepot identifier/name+target without deleting unrelated user shortcuts, preserve tags/fields, write a same-directory temporary file, validate, and atomically replace. Avoid concurrent writes while Steam is running: detect/coordinate with the user, offer a safe export/instructions or defer until Steam is closed, then ask Steam to reload/restart if needed. Handle multiple Steam libraries/users and read-only/Flatpak locations, and provide undo/removal limited to entries GameDepot created. Test crash safety and unknown VDF fields.

For Steam Deck: ship a normal desktop-client path first; verify SteamOS paths, permissions, read-only/Flatpak environments and Game Mode behavior on real hardware. Allow adding/removing shortcuts from Desktop Mode; show explicit restart/reload guidance. UMU can run a Windows game outside Steam using Proton/runtime configuration; when launched from Steam mode, test Steam app-ID/window behavior, controls, overlay and exit lifecycle. Keep per-title prefix selection configurable and separate from Steam depot/account state. A Decky plugin is a later optional UI only; it is not required for core support and should call the same supported client API rather than implement acquisition or secrets itself.

## 8. Legal, ownership, privacy and security gates

Steam Subscriber Agreement describes Steam content as licensed, personal/non-commercial in typical contexts and restricts copying/transfer/distribution subject to its terms and applicable law. Individual game EULAs and third-party rights can add restrictions. User-owned-account access does not automatically authorize a hosted or peer-to-peer copy for friends, a household or the public. Before any ingestion, server storage, backup sharing or mesh feature, obtain qualified legal review of the exact jurisdiction, account flow, terms and distribution model. Keep legal conclusions configurable only after review; include takedown/disable mechanisms if rights claims arise.

Security requirements:

- Steam credentials, QR challenge, auth codes, tokens and cookies never transit GameDepot server in local-first mode; encrypt persistent refresh/session tokens using OS keyring and offer revoke/delete.
- Explicit consent before linking, downloading, keeping tokens, using disk space, or registering shortcuts. Clear account identity, app/depot/branch/platform and local destination before acquisition.
- No server-side Steam credential collection; no shared torrent, mesh, CDN, seed, or public export of Steam-source bytes by default. Mark these releases `private/local-only` and enforce policy in API, storage ACLs, transfer authorization and peer eligibility—not just the UI.
- Least privilege, process sandboxing, no shell command construction, secret redaction, dependency pinning/signature checks, archive/path traversal defenses, content quotas, audit/job logs with no secret material, deletion/revocation, incident response and security testing.
- Review SteamKit/DepotDownloader/UMU/SteamGridDB dependency licenses and terms and Valve Steam API terms before productizing. Terms and upstream behavior may change; re-review before each release and do not claim Valve endorsement.

## 9. Implementation sequence and acceptance criteria

### A. Catalog and client launch (low-risk MVP)
1. Add Steam store provider enum/source and AppID mapping to catalog; prevent duplicate app records; persist metadata provenance/refresh time.
2. Add public Store metadata adapter with schema validation, sane timeouts, cache, rate limit, localized/missing-field tests and graceful failure.
3. Launch a Steam AppID through the installed Steam client; keep client invocation separate from GameDepot executable launch. No account credentials.
4. Tests: invalid/overflow AppIDs rejected; stale/missing metadata tolerated; URLs/HTML sanitized; no secrets required; logs contain no secret values.

### B. Artwork and local shortcuts
1. Add optional SteamGridDB key management, search/confirmation, attribution and image cache.
2. Define generic shortcut-export contract and Steam VDF provider; safe discovery, backup, merge/upsert, atomic write, deletion/rollback of owned entry only.
3. Tests: binary VDF round-trip preserves unknown fields and user entries; duplicate sync is idempotent; failure/crash leaves original intact; Steam-running detection and Deck paths; opt-in and undo UX.

### C. Entitlement review and local acquisition proof of concept (blocked until gate)
1. Complete legal/product/security review; document permitted games/regions/account flow and explicitly decide whether local download is allowed.
2. Run a user-invoked local DepotDownloader prototype with anonymized test/authorized public content; inspect upstream source/release/license and threat model. No credentials in argv; interactive auth/QR support only if upstream build supports it; otherwise do not simulate QR or roll a custom Steam login system.
3. Build app/depot/manifest resolver with ownership/access failures closed, platform/language selection, manifest provenance and interactive Steam Guard support. No community keys, unlockers or manifest bypasses.
4. Use isolated staging and verify each file/chunk, install into local-only storage, and test update rollback, cancel/resume, disk quota and token deletion.
5. Acceptance: independent code and terms review; no external transfer/peer seeding possible; verified install only; no secret leakage in process listing/logs/crash reports; revoke/logout/delete succeeds; CI tests mocked and integration tests use explicitly authorized content.

### D. Broader release only if separately authorized
Any shared server catalog, server-side account link, cloud storage, family/team distribution, CDN, cache, mesh, backup restore or public install is a separate legal and security review. Default answer is **do not implement** absent documented rights/authorization. Steam account ownership by a contributor is not authorization for a GameDepot hosted library.

## 10. External references

References are implementation research, not endorsements or guarantees. Re-check source, versions, terms and API behavior at implementation time.

- [Steam Subscriber Agreement](https://store.steampowered.com/subscriber_agreement/)
- [Steam Web API reference](https://partner.steamgames.com/doc/webapi)
- [Steam Store IStoreService](https://partner.steamgames.com/doc/webapi/IStoreService)
- [Steam Guard Mobile Authenticator / QR login](https://help.steampowered.com/en/faqs/view/7EFD-3CAE-64D3-1C31)
- [SteamKit2](https://context7.com/steamre/steamkit/llms.txt?tokens=10000)
- [SteamRE DepotDownloader](https://github.com/SteamRE/DepotDownloader)
- [SteamGridDB API v2](https://www.steamgriddb.com/api/v2)
- [umu-launcher](https://github.com/Open-Wine-Components/umu-launcher)
- [Valve: Adding Non-Steam Games](https://developer.valvesoftware.com/wiki/Add_Non-Steam_Game)
