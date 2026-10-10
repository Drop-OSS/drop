import test from "node:test";
import assert from "node:assert/strict";
import { PluginManager } from "../manager";
import { PLUGIN_API_VERSION, SUPPORTED_API_VERSIONS } from "../types";
import type { PluginContext, PluginStorage, ServerPlugin } from "../types";

/**
 * Host-side conformance for the `@drop-oss/plugin-sdk` server contract.
 *
 * The SDK ships `MockPluginContext`, but that mirrors the SDK's own types, not
 * this host, so it cannot detect a capability the SDK declares while the server
 * runtime silently omits it. This test pins the server runtime against the SDK
 * contract: every `PluginContext` member the SDK exposes must exist at runtime,
 * and every server capability must have a working, capability-gated
 * registration path.
 */

/** Canonical `ServerCapability` list from `@drop-oss/plugin-sdk@0.7.0`. */
const SDK_SERVER_CAPABILITIES = [
  "routes",
  "storage",
  "websocket",
  "events",
  "network",
  "metadata:provider",
  "commerce:payment",
  "cloudsave:provider",
  "auth:provider",
  "storage:depot",
] as const;

/** Canonical `PluginContext` member names from `@drop-oss/plugin-sdk@0.7.0`. */
const SDK_PLUGIN_CONTEXT_MEMBERS = [
  "id",
  "logger",
  "storage",
  "settings",
  "registerRoute",
  "broadcast",
  "subscribe",
  "registerWebSocket",
  "registerPublicWebSocketChannel",
  "registerSubscriptionAuthorizer",
  "fetch",
  "registerMetadataProvider",
  "registerCloudSaveResolver",
  "registerPaymentGateway",
  "registerAuthProvider",
  "registerDepotProvider",
  "scheduleTask",
] as const;

class MemoryStorage implements PluginStorage {
  private readonly data = new Map<string, unknown>();
  private schemaVersion = 0;
  async get<T>(key: string): Promise<T | null> {
    return this.data.has(key) ? (this.data.get(key) as T) : null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
  async listKeys(): Promise<string[]> {
    return [...this.data.keys()];
  }
  async getSchemaVersion(): Promise<number> {
    return this.schemaVersion;
  }
  async setSchemaVersion(version: number): Promise<void> {
    this.schemaVersion = version;
  }
}

function createManager(): PluginManager {
  return new PluginManager({
    storageFactory: () => new MemoryStorage(),
    authResolver: async () => ({ userId: undefined }),
  });
}

test("server plugin API version matches the SDK contract", () => {
  assert.equal(PLUGIN_API_VERSION, 3);
  assert.deepEqual([...SUPPORTED_API_VERSIONS], [1, 2, 3]);
});

test("PluginContext exposes every member the SDK declares", async () => {
  const manager = createManager();
  let context: PluginContext | undefined;

  const plugin: ServerPlugin = {
    metadata: {
      id: "context-surface",
      name: "Context Surface",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
      capabilities: [...SDK_SERVER_CAPABILITIES],
    },
    init: (ctx) => {
      context = ctx;
    },
  };

  await manager.registerPlugin(plugin);
  assert.ok(context);
  const keys = new Set(Object.keys(context as PluginContext));
  for (const member of SDK_PLUGIN_CONTEXT_MEMBERS) {
    assert.ok(keys.has(member), `PluginContext is missing '${member}'`);
  }
  await manager.unregisterPlugin("context-surface");
});

test("every SDK server capability registers through its runtime path", async () => {
  const manager = createManager();

  // One plugin declaring every server capability exercises each registration
  // path so a capability declared by the SDK but missing at runtime fails here.
  const plugin: ServerPlugin = {
    metadata: {
      id: "all-server-caps",
      name: "All Server Caps",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
      capabilities: [...SDK_SERVER_CAPABILITIES],
    },
    init: (ctx) => {
      ctx.registerRoute("GET", "/conformance", () => ({ ok: true }));
      ctx.subscribe("conformance:event", () => {});
      ctx.broadcast("conformance:event", { ok: true });
      ctx.registerWebSocket("conformance:ws", () => {});
      ctx.registerPublicWebSocketChannel("conformance:public");
      ctx.registerSubscriptionAuthorizer(
        (channel) => channel === "conformance:ws",
        () => true,
      );
      ctx.registerMetadataProvider({
        id: "conformance-metadata",
        name: "Conformance",
        search: async () => [],
        getDetails: async () => null,
      });
      ctx.registerCloudSaveResolver({
        id: "conformance-cloudsave",
        name: "Conformance",
        resolveSavePaths: async () => [],
      });
      ctx.registerPaymentGateway({
        id: "conformance-payment",
        name: "Conformance",
        createPaymentIntent: async () => ({
          intentId: "i",
          status: "pending",
        }),
        handleWebhook: async () => ({
          orderId: "o",
          status: "succeeded",
          transactionId: "t",
        }),
      });
      ctx.registerAuthProvider?.({
        id: "conformance-auth",
        name: "Conformance",
        authenticate: async () => ({ authenticated: false }),
      });
      ctx.registerDepotProvider?.({
        id: "conformance-depot",
        name: "Conformance",
        resolveDepotStream: async () => null,
      });
      ctx.scheduleTask?.("conformance-task", 60_000, () => {});
    },
  };

  await manager.registerPlugin(plugin);

  assert.equal(
    manager.getPlugin("all-server-caps")?.metadata.id,
    "all-server-caps",
  );
  assert.equal(
    manager.getMetadataProvider("conformance-metadata")?.name,
    "Conformance",
  );
  assert.equal(
    manager.getCloudSaveResolver("conformance-cloudsave")?.name,
    "Conformance",
  );
  assert.equal(
    manager.getPaymentGateway("conformance-payment")?.name,
    "Conformance",
  );
  assert.equal(
    manager.getAuthProvider("conformance-auth")?.name,
    "Conformance",
  );
  assert.equal(
    manager.getDepotProvider("conformance-depot")?.name,
    "Conformance",
  );
  assert.equal(
    manager.getPluginSettings("all-server-caps") !== undefined,
    true,
  );

  await manager.unregisterPlugin("all-server-caps");
  assert.equal(manager.getAuthProvider("conformance-auth"), undefined);
  assert.equal(manager.getDepotProvider("conformance-depot"), undefined);
});

test("each SDK server capability is enforced fail-closed when undeclared", async () => {
  const manager = createManager();

  const operations: Array<{
    capability: (typeof SDK_SERVER_CAPABILITIES)[number];
    use: (ctx: PluginContext) => void | Promise<void>;
  }> = [
    {
      capability: "routes",
      use: (ctx) => ctx.registerRoute("GET", "/x", () => ({})),
    },
    {
      capability: "storage",
      use: async (ctx) => {
        await ctx.storage.get("x");
      },
    },
    {
      capability: "network",
      use: async (ctx) => {
        await ctx.fetch("https://example.invalid/");
      },
    },
    {
      capability: "events",
      use: (ctx) => ctx.subscribe("x", () => {}),
    },
    {
      capability: "events",
      use: (ctx) => ctx.broadcast("x", {}),
    },
    {
      capability: "websocket",
      use: (ctx) => ctx.registerWebSocket("x", () => {}),
    },
    {
      capability: "websocket",
      use: (ctx) => ctx.registerPublicWebSocketChannel("x"),
    },
    {
      capability: "websocket",
      use: (ctx) =>
        ctx.registerSubscriptionAuthorizer(
          () => true,
          () => true,
        ),
    },
    {
      capability: "metadata:provider",
      use: (ctx) =>
        ctx.registerMetadataProvider({
          id: "denied-meta",
          name: "Denied",
          search: async () => [],
          getDetails: async () => null,
        }),
    },
    {
      capability: "cloudsave:provider",
      use: (ctx) =>
        ctx.registerCloudSaveResolver({
          id: "denied-cloud",
          name: "Denied",
          resolveSavePaths: async () => [],
        }),
    },
    {
      capability: "commerce:payment",
      use: (ctx) =>
        ctx.registerPaymentGateway({
          id: "denied-pay",
          name: "Denied",
          createPaymentIntent: async () => ({
            intentId: "i",
            status: "pending",
          }),
          handleWebhook: async () => ({
            orderId: "o",
            status: "succeeded",
            transactionId: "t",
          }),
        }),
    },
    {
      capability: "auth:provider",
      use: (ctx) =>
        ctx.registerAuthProvider?.({
          id: "denied-auth",
          name: "Denied",
          authenticate: async () => ({ authenticated: false }),
        }),
    },
    {
      capability: "storage:depot",
      use: (ctx) =>
        ctx.registerDepotProvider?.({
          id: "denied-depot",
          name: "Denied",
          resolveDepotStream: async () => null,
        }),
    },
  ];

  for (const { capability, use } of operations) {
    const id = `denied-${capability.replace(/[^a-z]/g, "-")}`;
    const plugin: ServerPlugin = {
      metadata: {
        id,
        name: "Denied",
        version: "1.0.0",
        apiVersion: PLUGIN_API_VERSION,
        capabilities: [],
      },
      init: async (ctx) => {
        await use(ctx);
      },
    };
    await assert.rejects(
      () => manager.registerPlugin(plugin),
      new RegExp(`'${capability}' capability`),
      `expected '${capability}' to be capability-gated`,
    );
  }
});
