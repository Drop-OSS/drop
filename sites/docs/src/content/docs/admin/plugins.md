---
title: Plugins
---

Drop supports an extensible plugin runtime across both the server and desktop client.
A server plugin can register HTTP routes under `/api/v1/plugins/<id>/...`, subscribe/broadcast events, use namespaced storage, and handle WebSocket messages. Desktop client plugins can contribute UI panels, status badges, Play Actions, and game launch hooks.

:::danger[Plugins run with full host privileges]
Plugins are **not sandboxed**. Server plugins execute in-process with the Drop server's own privileges; desktop plugins execute in-process with the desktop client's privileges. Native commands run through the desktop host are **unsandboxed** — they are only checked against the plugin's allowlist, not confined. Declared capabilities are used for validation and review, not for confinement. Only install plugins you trust, and prefer signed bundles from sources you control.
:::

---

## Architecture & Toolchain

The developer toolchain and runtime contracts are maintained in the Drop Plugin SDK repository at [`Drop-OSS/drop-plugin-sdk`](https://github.com/Drop-OSS/drop-plugin-sdk) (the repository is being transferred there from [`Heretek-Games/drop-plugin-sdk`](https://github.com/Heretek-Games/drop-plugin-sdk); until the transfer lands, the latter remains the canonical source):

- **SDK (`@drop-oss/plugin-sdk`)**: Public TypeScript contracts, JSON Schema, and mock harnesses (`MockPluginContext`, `MockClientPluginContext`).
- **CLI (`@drop-oss/plugin-cli`)**: Developer CLI (`drop-plugin`) providing `init`, `build`, `test`, `validate`, `sign`, `verify`, and `pack`.

:::note
The `@drop-oss` package scope takes effect with SDK **0.6.0**. The currently published **0.5.x** releases are still published as `@droposs/plugin-sdk` and `@droposs/plugin-cli`. The examples below use the `@drop-oss` names; substitute the `@droposs` names if you are on 0.5.x.
:::

---

## Bundle Format

A plugin lives in `<dataDir>/plugins/<id>/` and contains:

| File                            | Purpose                                                                                          |
| :------------------------------ | :----------------------------------------------------------------------------------------------- |
| `drop-plugin.json`              | Manifest: `id`, `name`, `version`, `apiVersion`, `targets`, `capabilities`, `server`, `client` … |
| `index.js` (or `server.entry`)  | Server plugin module (default export with `init(ctx)`).                                          |
| `client.js` (or `client.entry`) | Optional client plugin module (default export with `init(ctx)`).                                 |

### `drop-plugin.json` Fields

- `id`, `name`, `version` — required.
- `apiVersion` — plugin API version (currently `3`; Drop maintains backwards compatibility with `1` and `2`).
- `targets` — `["server"]`, `["client"]`, or `["server", "client"]`.
- `capabilities` — explicitly declared permissions:
  - **Server**: `routes`, `storage`, `events`, `network`, `websocket`, `metadata:provider`, `cloudsave:provider`, `commerce:payment`, `auth:provider`, `storage:depot`.
  - **Client**: `ui:slot`, `ui:play-action`, `ui:context-menu`, `ui:sidebar`, `ui:topbar`, `game:launch-hook`, `game:fs`, `game:scan`, `client:storage`, `client:ws`, `client:library-scan`, `game:runner`.
- `settingsSchema` — optional declarative settings schema rendered automatically by host UIs.
- `entry` — relative path to primary entry point (default `index.js`).
- `checksum` — SHA-256 hex digest of the primary entry file.
- `files` — mapping of relative bundle file paths to their individual SHA-256 digests. Required for multi-file bundles.
- `signatureVersion` — signature scheme marker. Bundles signed by `@drop-oss/plugin-cli` 0.6.0+ carry `2`, meaning `signature` covers the aggregate bundle digest **plus the canonical manifest** (everything except `signature` itself). Legacy bundles omit the marker, and their signature covers only the file aggregate or the entry checksum.
- `signature` — HMAC-SHA256 of the signature payload under `DROP_PLUGIN_SIGNING_KEY`. For `signatureVersion: 2` bundles this covers the file aggregate and the manifest; for legacy bundles it covers the aggregate bundle digest (or `checksum` for single-file bundles).

---

## Building, Signing & Packaging

Using the Drop Plugin CLI (`@drop-oss/plugin-cli`):

```sh
# Bundle TypeScript server and client sources into ESM dist/
npx @drop-oss/plugin-cli build .

# Validate manifest against schema
npx @drop-oss/plugin-cli validate .

# Sign drop-plugin.json with SHA-256 digests and HMAC signature
export DROP_PLUGIN_SIGNING_KEY="secret-key"
npx @drop-oss/plugin-cli sign .

# Verify digests and (when present) the signature of a built bundle
npx @drop-oss/plugin-cli verify . --allow-unsigned

# Package into a .dropplugin distribution archive
npx @drop-oss/plugin-cli pack . ./dist-package
```

`drop-plugin verify` recalculates every SHA-256 digest and, for signed bundles, validates the HMAC signature. Run it before installing a bundle you did not build yourself. Set `DROP_PLUGIN_REQUIRE_SIGNATURE=true` on the server to refuse unsigned bundles.

---

## Registry (Allow-list, Pinning & Remote Index)

Set `DROP_PLUGIN_REGISTRY` to a JSON file path or a remote HTTP/HTTPS URL (`https://.../registry.json`) to enforce an allow-list, pin exact versions, and verify aggregate bundle checksums:

```json
{
  "plugins": [
    {
      "checksum": "<sha256>",
      "downloadUrl": "https://plugins.example.com/sample-plugin.dropplugin",
      "id": "sample-plugin",
      "name": "Sample Plugin",
      "version": "1.0.0"
    }
  ]
}
```

- **Fail-Closed Default**: When configured, any unlisted plugin or any version/checksum mismatch is rejected at install time and load time.
- **Remote Fetching**: The server fetches remote registries with an automatic timeout and verifies response status; unreachable registries fail closed to protect integrity.

---

## Signing Key Distribution & Trust Guidance

By default, plugins run trusted in-process with the host's full privileges, as described in the warning at the top of this page. To enforce cryptographic integrity and supply chain provenance:

1. **Require Signatures**: Set `DROP_PLUGIN_REQUIRE_SIGNATURE=true` on the server. Any bundle without a cryptographic `signature` is refused immediately.
2. **Key Distribution**: Set `DROP_PLUGIN_SIGNING_KEY="<hmac-secret>"` across build pipelines and the Drop server instance. The CLI `drop-plugin sign` signs the aggregate digest across all bundle files; with `signatureVersion: 2` (0.6.0+) the canonical manifest is covered as well, so manifest tampering invalidates the signature.
3. **Registry Pinning**: Combine with a pinned registry index to enforce dual verification: exact SHA-256 code digest plus cryptographic HMAC signature.
4. **Verify Before Install**: Run `drop-plugin verify` on any bundle you did not build. Capabilities are declared in the manifest for review; they do not sandbox the plugin.

---

## Installing Bundles

### 1. Via Desktop Client Settings

Navigate to **Settings → Plugins & Extensions** and click **Upload .dropplugin / JSON** to select a `.dropplugin` package, or paste the bundle JSON directly. The desktop client shows a **Review Plugin Permissions** consent dialog listing the manifest's declared capabilities before the plugin is installed.

### 2. Via Admin API (Install-by-URL or Multi-file Package)

The server admin install flow does **not** show a capability-consent dialog. Inspect the manifest's declared capabilities and the bundle's signature yourself before installing.

Install via `POST /api/v1/plugins/install` with an admin token:

#### Install by URL:

```sh
curl -X POST "$DROP_URL/api/v1/plugins/install" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "url": "https://plugins.example.com/my-plugin.dropplugin" }'
```

#### Multi-file Package / `.dropplugin` Payload:

```sh
curl -X POST "$DROP_URL/api/v1/plugins/install" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": {
      "id": "my-plugin",
      "name": "My Plugin",
      "version": "1.0.0",
      "apiVersion": 3,
      "targets": ["server"],
      "capabilities": ["routes"],
      "entry": "dist/index.js",
      "files": {
        "dist/index.js": "<sha256>"
      }
    },
    "files": {
      "dist/index.js": "<base64>"
    }
  }'
```

#### Filesystem Copy:

Copy a bundle into `<dataDir>/plugins/<id>/` and reload:

```sh
curl -X POST "$DROP_URL/api/v1/plugins/reload" -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Management API

- `GET /api/v1/plugins` — list registered plugins and lifecycle status.
- `GET /api/v1/plugins/updates` — check installed plugins against the active registry for available version updates.
- `PATCH /api/v1/plugins/<id>/state` `{ "enabled": true|false }` — toggle plugin active state.
- `DELETE /api/v1/plugins/<id>/bundle` — remove an external plugin bundle from disk.
- `POST /api/v1/plugins/reload` — reload all external bundles from disk.

Built-in plugins cannot be removed.
