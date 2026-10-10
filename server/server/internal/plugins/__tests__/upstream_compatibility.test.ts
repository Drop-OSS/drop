import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { PluginManager } from "../manager";
import {
  PLUGIN_API_VERSION,
  SUPPORTED_API_VERSIONS,
  type ServerPlugin,
  type PluginContext,
  type PluginManifest,
} from "../types";
import { assertManifestCompatible, assertPluginCompatible } from "../compat";
import { PluginApiVersionError } from "../errors";

function tmpDataDir(): string {
  const prefix = path.join(
    os.tmpdir(),
    `drop-upstream-compat-${process.pid}-${Math.random().toString(36).slice(2)}`,
  );
  return prefix;
}

test("Upstream Invariant: Zero-plugin baseline leaves server in pure vanilla state", async (t) => {
  const dataDir = tmpDataDir();
  t.after(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const manager = new PluginManager({ dataDir });

  // 1. Initial inventory must be completely empty
  const plugins = manager.listPlugins();
  assert.equal(
    plugins.length,
    0,
    "Default plugin list should be empty when no plugins are installed",
  );

  // 2. No routes or websockets registered
  assert.equal(
    manager.webSocketChannels().length,
    0,
    "No WebSocket channels should exist by default",
  );
  assert.equal(
    manager.publicWebSocketChannels().length,
    0,
    "No public channels should exist by default",
  );
  assert.equal(
    manager.getMetadataProviders().length,
    0,
    "No metadata providers should exist by default",
  );
  assert.equal(
    manager.getCloudSaveResolvers().length,
    0,
    "No cloud save resolvers should exist by default",
  );
  assert.equal(
    manager.getPaymentGateways().length,
    0,
    "No payment gateways should exist by default",
  );

  // 3. Dispatching to nonexistent plugin fails with 404
  await assert.rejects(
    () => manager.dispatch("nonexistent", "GET", "/test", {} as never),
    (err: unknown) => (err as { statusCode?: number })?.statusCode === 404,
    "Dispatch to missing plugin must reject with 404",
  );

  // 4. Checking updates on zero plugins yields empty list
  const updates = await manager.checkForUpdates();
  assert.deepEqual(
    updates,
    [],
    "Zero installed plugins must yield zero update notifications",
  );
});

test("Upstream Invariant: Dynamic public WebSocket channels function without hardcoded core identifiers", async (t) => {
  const dataDir = tmpDataDir();
  t.after(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const manager = new PluginManager({ dataDir });

  const communityLobbyPlugin: ServerPlugin = {
    metadata: {
      id: "community-lobby",
      name: "Community Lobby Provider",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
      capabilities: ["websocket"],
    },
    init: (ctx: PluginContext) => {
      // Register public channel via options
      ctx.registerWebSocket(
        "community:lobbies",
        (msg, wsCtx) => {
          wsCtx.send({ echo: msg });
        },
        { public: true },
      );

      // Register public channel explicitly
      ctx.registerPublicWebSocketChannel("community:announcements");

      // Register authenticated channel
      ctx.registerWebSocket("community:private-chat", () => {});
    },
  };

  await manager.registerPlugin(communityLobbyPlugin);

  // Public channels are accessible without auth
  assert.equal(manager.isPublicChannel("community:lobbies"), true);
  assert.equal(manager.isPublicChannel("community:announcements"), true);
  assert.equal(manager.isPublicChannel("community:private-chat"), false);
  assert.equal(
    manager.isPublicChannel("gse:rooms"),
    false,
    "gse:rooms must not be hardcoded as public",
  );

  // Unregistering cleanly wipes out public channel designations
  await manager.unregisterPlugin("community-lobby");
  assert.equal(manager.isPublicChannel("community:lobbies"), false);
  assert.equal(manager.isPublicChannel("community:announcements"), false);
});

test("Upstream Invariant: Plugin lifecycle isolation leaves zero residual state upon uninstall", async (t) => {
  const dataDir = tmpDataDir();
  t.after(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const manager = new PluginManager({ dataDir });

  let eventCount = 0;
  const samplePlugin: ServerPlugin = {
    metadata: {
      id: "lifecycle-isolated",
      name: "Lifecycle Isolated Plugin",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
      capabilities: ["routes", "websocket", "events", "storage"],
    },
    init: (ctx: PluginContext) => {
      ctx.registerRoute("GET", "/ping", () => ({ status: "ok" }));
      ctx.registerWebSocket("isolated:ws", () => {}, { public: true });
      ctx.subscribe("core:ping", () => {
        eventCount++;
      });
    },
  };

  await manager.registerPlugin(samplePlugin);
  assert.equal(manager.listPlugins().length, 1);
  assert.equal(manager.isPublicChannel("isolated:ws"), true);

  // Broadcast event received
  manager.broadcast("core:ping", {});
  assert.equal(eventCount, 1);

  // Unregister plugin
  await manager.unregisterPlugin("lifecycle-isolated");

  // Verify zero residue
  assert.equal(manager.listPlugins().length, 0);
  assert.equal(manager.isPublicChannel("isolated:ws"), false);
  assert.equal(manager.webSocketChannels().includes("isolated:ws"), false);

  // Further broadcasts are not received
  manager.broadcast("core:ping", {});
  assert.equal(
    eventCount,
    1,
    "Unregistered plugin must not receive subsequent broadcasts",
  );
});

test("Upstream Invariant: Plugin SDK v0.7.0 (apiVersion 3) and settingsSchema contracts are fully compatible", async (t) => {
  const dataDir = tmpDataDir();
  t.after(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const manager = new PluginManager({ dataDir });

  // 1. Assert SUPPORTED_API_VERSIONS includes 1, 2, and 3
  assert.deepEqual(SUPPORTED_API_VERSIONS, [1, 2, 3]);
  assert.equal(PLUGIN_API_VERSION, 3);

  // 2. Compatibility check succeeds for versions 1, 2, and 3
  for (const v of [1, 2, 3]) {
    const manifest: PluginManifest = {
      id: `plugin-v${v}`,
      name: `Plugin V${v}`,
      version: "1.0.0",
      apiVersion: v,
    };
    assert.doesNotThrow(() => assertManifestCompatible(manifest));

    const plugin: ServerPlugin = {
      metadata: manifest,
      init: () => {},
    };
    assert.doesNotThrow(() => assertPluginCompatible(plugin));
  }

  // 3. Incompatible versions (0, 4) throw PluginApiVersionError
  for (const invalidVer of [0, 4]) {
    const invalidManifest: PluginManifest = {
      id: "invalid-ver",
      name: "Invalid",
      version: "1.0.0",
      apiVersion: invalidVer,
    };
    assert.throws(
      () => assertManifestCompatible(invalidManifest),
      PluginApiVersionError,
    );
  }

  // 4. Register a plugin using SDK v0.7.0 features: settingsSchema, ctx.settings, extended capabilities
  let capturedSettings: Readonly<Record<string, unknown>> | undefined;
  const v3Plugin: ServerPlugin = {
    metadata: {
      id: "sdk-v3-plugin",
      name: "SDK v3 Plugin",
      version: "1.0.0",
      apiVersion: 3,
      capabilities: ["routes", "auth:provider", "storage:depot"],
      settingsSchema: {
        fields: [
          {
            key: "apiKey",
            label: "API Key",
            type: "password",
            required: true,
          },
          {
            key: "enableFeature",
            label: "Enable Feature",
            type: "boolean",
            default: true,
          },
        ],
      },
    },
    init: (ctx: PluginContext) => {
      capturedSettings = ctx.settings;
    },
  };

  await manager.registerPlugin(v3Plugin);
  const registered = manager.getPlugin("sdk-v3-plugin");
  assert.ok(registered);
  assert.equal(registered.metadata.apiVersion, 3);
  assert.equal(registered.metadata.settingsSchema?.fields.length, 2);
  assert.ok(capturedSettings);
  assert.equal(typeof capturedSettings, "object");
  assert.equal(Object.isFrozen(capturedSettings), true);

  await manager.unregisterPlugin("sdk-v3-plugin");
});

