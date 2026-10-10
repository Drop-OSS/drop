import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { H3Event } from "h3";
import { PluginEventBus } from "../events";
import { PluginRegistry } from "../registry";
import { PluginRouteTable } from "../routes";
import { PluginWebSocketRegistry } from "../websocket";
import {
  PluginWebSocketGateway,
  isAllowedOrigin,
  parseClientMessage,
} from "../ws-gateway";
import type { PluginWebSocketManager, WebSocketPeer } from "../ws-gateway";
import { signaturePayloadV2 } from "../signature";
import type { PluginManifest } from "../types";

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Reproduces the manager's aggregate digest over sorted bundle files. */
function computeAggregate(files: Array<[string, string]>): string {
  const hasher = createHash("sha256");
  for (const [rel, content] of [...files].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const bytes = Buffer.from(content);
    hasher.update(rel);
    hasher.update("\0");
    hasher.update(String(bytes.length));
    hasher.update("\0");
    hasher.update(bytes);
  }
  return hasher.digest("hex");
}

interface FakePeer extends WebSocketPeer {
  sent: string[];
  closed: boolean;
}

function fakePeer(id: string, headers: Record<string, string> = {}): FakePeer {
  const peer: FakePeer = {
    id,
    request: { headers: new Headers(headers) },
    sent: [],
    closed: false,
    send(payload: string) {
      peer.sent.push(payload);
    },
    close() {
      peer.closed = true;
    },
  };
  return peer;
}

class FakeGatewayManager implements PluginWebSocketManager {
  readonly listeners = new Map<string, Set<(data: unknown) => void>>();
  readonly dispatched: Array<{ channel: string; message: unknown }> = [];
  readonly publicChannels = new Set<string>();
  allPublic = false;

  isPublicChannel(channel: string): boolean {
    return this.allPublic || this.publicChannels.has(channel);
  }

  async canSubscribe(): Promise<boolean> {
    return true;
  }

  subscribe(channel: string, listener: (data: unknown) => void): () => void {
    const listeners = this.listeners.get(channel) ?? new Set();
    listeners.add(listener);
    this.listeners.set(channel, listeners);
    return () => {
      listeners.delete(listener);
    };
  }

  async dispatchWebSocket(channel: string, message: unknown): Promise<boolean> {
    if (channel === "ws:missing") return false;
    this.dispatched.push({ channel, message });
    return true;
  }

  broadcast(channel: string, data: unknown): void {
    for (const listener of this.listeners.get(channel) ?? []) {
      listener(data);
    }
  }
}

test("PluginEventBus releases scoped subscriptions but keeps global ones", () => {
  const bus = new PluginEventBus();
  let scoped = 0;
  let global = 0;

  bus.subscribeScoped("plugin-a", "tick", () => {
    scoped++;
  });
  const unsubscribe = bus.subscribe("tick", () => {
    global++;
  });

  bus.emit("tick", null);
  assert.equal(scoped, 1);
  assert.equal(global, 1);

  bus.release("plugin-a");
  bus.emit("tick", null);
  assert.equal(scoped, 1);
  assert.equal(global, 2);

  unsubscribe();
  bus.emit("tick", null);
  assert.equal(global, 2);
});

test("PluginRouteTable escapes metacharacters, extracts params, and 404s", async () => {
  const table = new PluginRouteTable();
  table.create("route-plugin");
  table.register("route-plugin", "GET", "/literal/(a+)+", () => ({
    literal: true,
  }));
  table.register("route-plugin", "GET", "/items/:id", (_event, context) => ({
    id: context.params.id,
  }));

  const event = {
    method: "GET",
    headers: new Headers(),
  } as unknown as H3Event;

  assert.deepEqual(
    await table.dispatch(
      "route-plugin",
      "GET",
      "/literal/(a+)+",
      event,
      async () => ({}),
    ),
    { literal: true },
  );
  assert.deepEqual(
    await table.dispatch(
      "route-plugin",
      "GET",
      "/items/42",
      event,
      async () => ({}),
    ),
    { id: "42" },
  );
  await assert.rejects(
    () =>
      table.dispatch(
        "route-plugin",
        "GET",
        "/literal/aaaa",
        event,
        async () => ({}),
      ),
    /No handler found/,
  );
});

test("PluginWebSocketRegistry gates dispatch on plugin status and releases ownership", async () => {
  const registry = new PluginWebSocketRegistry();
  let received: unknown;

  registry.register(
    "ws-owner",
    "ws:room",
    (message) => {
      received = message;
    },
    { public: true },
  );
  registry.addAuthorizer(
    "ws-owner",
    () => true,
    () => false,
  );
  assert.equal(registry.isPublicChannel("ws:room"), true);
  assert.deepEqual(registry.channels(), ["ws:room"]);

  // Inactive plugins never receive messages.
  assert.equal(
    await registry.dispatch(
      "ws:room",
      { a: 1 },
      { send: () => {} },
      () => false,
    ),
    false,
  );
  assert.equal(
    await registry.dispatch(
      "ws:room",
      { a: 1 },
      { send: () => {} },
      () => true,
    ),
    true,
  );
  assert.deepEqual(received, { a: 1 });

  registry.release("ws-owner");
  assert.equal(registry.isPublicChannel("ws:room"), false);
  assert.deepEqual(registry.channels(), []);
  assert.equal(
    await registry.dispatch("ws:room", {}, { send: () => {} }, () => true),
    false,
  );
  // The authorizer was removed with its plugin.
  assert.equal(
    await registry.canSubscribe("ws:room", {
      userId: undefined,
      userAcls: undefined,
    }),
    true,
  );
});

test("parseClientMessage caps frames at 64 KiB", () => {
  const small = JSON.stringify({ type: "subscribe", channel: "ws:public" });
  assert.deepEqual(parseClientMessage({ text: () => small }), {
    type: "subscribe",
    channel: "ws:public",
  });

  const oversized = JSON.stringify({ pad: "x".repeat(64 * 1024) });
  assert.equal(parseClientMessage({ text: () => oversized }), undefined);
  assert.equal(parseClientMessage({ text: () => "not json" }), undefined);
});

test("isAllowedOrigin rejects cross-site upgrades and allows missing Origin", () => {
  assert.equal(
    isAllowedOrigin(
      fakePeer("cross-site", {
        host: "drop.example",
        origin: "https://evil.example",
      }),
    ),
    false,
  );
  assert.equal(
    isAllowedOrigin(
      fakePeer("same-site", {
        host: "drop.example",
        origin: "https://drop.example",
      }),
    ),
    true,
  );
  // Non-browser clients omit Origin.
  assert.equal(
    isAllowedOrigin(fakePeer("native", { host: "drop.example" })),
    true,
  );
});

test("PluginWebSocketGateway enforces origin, channel validation and public gating", async () => {
  const manager = new FakeGatewayManager();
  manager.publicChannels.add("ws:public");
  const gateway = new PluginWebSocketGateway(manager);

  const crossSite = fakePeer("cross-site", {
    host: "drop.example",
    origin: "https://evil.example",
  });
  await gateway.open(crossSite);
  assert.equal(crossSite.closed, true);

  const guest = fakePeer("guest", { host: "drop.example" });
  await gateway.open(guest);
  assert.equal(guest.closed, false);

  // Invalid channel names are ignored entirely.
  await gateway.message(guest, {
    text: () => JSON.stringify({ type: "subscribe", channel: "bad channel!" }),
  });
  assert.equal(manager.listeners.size, 0);

  // Private channels require authentication.
  await gateway.message(guest, {
    text: () => JSON.stringify({ type: "subscribe", channel: "ws:private" }),
  });
  assert.deepEqual(JSON.parse(guest.sent[0] ?? "{}"), {
    channel: "ws:private",
    error: "authentication required",
  });

  // Public channels are subscribable and receive broadcasts.
  await gateway.message(guest, {
    text: () => JSON.stringify({ type: "subscribe", channel: "ws:public" }),
  });
  manager.broadcast("ws:public", { hello: 1 });
  assert.deepEqual(JSON.parse(guest.sent.at(-1) ?? "{}"), {
    channel: "ws:public",
    data: { hello: 1 },
  });

  // Client messages are routed to the plugin handler.
  await gateway.message(guest, {
    text: () =>
      JSON.stringify({ type: "message", channel: "ws:public", data: "ping" }),
  });
  assert.deepEqual(manager.dispatched, [
    { channel: "ws:public", message: "ping" },
  ]);

  // Closing the peer tears down every subscription.
  gateway.close(guest);
  manager.broadcast("ws:public", { hello: 2 });
  assert.equal(guest.sent.length, 2);
});

test("PluginWebSocketGateway caps subscriptions per peer at 32", async () => {
  const manager = new FakeGatewayManager();
  manager.allPublic = true;
  const gateway = new PluginWebSocketGateway(manager);
  const peer = fakePeer("subscriber", { host: "drop.example" });
  await gateway.open(peer);

  for (let i = 0; i < 33; i++) {
    await gateway.message(peer, {
      text: () =>
        JSON.stringify({ type: "subscribe", channel: `ws:channel${i}` }),
    });
  }

  assert.equal(manager.listeners.size, 32);
  assert.deepEqual(JSON.parse(peer.sent.at(-1) ?? "{}"), {
    channel: "ws:channel32",
    error: "too many subscriptions",
  });
});

test("PluginRegistry.verifyBundle verifies checksums, signature and pinning in order", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "drop-verify-bundle-"));
  const previousKey = process.env.DROP_PLUGIN_SIGNING_KEY;
  const previousRequire = process.env.DROP_PLUGIN_REQUIRE_SIGNATURE;
  t.after(async () => {
    if (previousKey === undefined) {
      delete process.env.DROP_PLUGIN_SIGNING_KEY;
    } else {
      process.env.DROP_PLUGIN_SIGNING_KEY = previousKey;
    }
    if (previousRequire === undefined) {
      delete process.env.DROP_PLUGIN_REQUIRE_SIGNATURE;
    } else {
      process.env.DROP_PLUGIN_REQUIRE_SIGNATURE = previousRequire;
    }
    await fs.rm(dir, { recursive: true, force: true });
  });

  const entry =
    "import { value } from './helper.mjs';\n" +
    "export default { metadata: { id: 'verify-demo' }, init() { void value; } };\n";
  const helper = "export const value = 1;\n";
  await fs.writeFile(path.join(dir, "index.mjs"), entry);
  await fs.writeFile(path.join(dir, "helper.mjs"), helper);

  const entryDigest = sha256(entry);
  const files = {
    "index.mjs": entryDigest,
    "helper.mjs": sha256(helper),
  };
  const aggregate = computeAggregate([
    ["index.mjs", entry],
    ["helper.mjs", helper],
  ]);

  const signingKey = "verify-bundle-key";
  process.env.DROP_PLUGIN_SIGNING_KEY = signingKey;
  const manifestBase = {
    id: "verify-demo",
    name: "Verify",
    version: "1.0.0",
    apiVersion: 2,
    entry: "index.mjs",
    checksum: entryDigest,
    files,
  };
  const payload = signaturePayloadV2(aggregate, {
    ...manifestBase,
    signatureVersion: 2,
  });
  const manifest: PluginManifest = {
    ...manifestBase,
    signatureVersion: 2,
    signature: createHmac("sha256", signingKey).update(payload).digest("hex"),
  };
  const entryPath = path.join(dir, "index.mjs");

  const pinned = new PluginRegistry(
    [{ id: "verify-demo", version: "1.0.0", checksum: entryDigest }],
    true,
  );
  assert.equal(await pinned.verifyBundle(dir, manifest, entryPath), aggregate);

  // Signature verification runs before registry pinning.
  const wrongPin = new PluginRegistry(
    [{ id: "verify-demo", checksum: "0".repeat(64) }],
    true,
  );
  await assert.rejects(
    () =>
      wrongPin.verifyBundle(
        dir,
        { ...manifest, signature: "0".repeat(64) },
        entryPath,
      ),
    /bundle signature mismatch/,
  );
  await assert.rejects(
    () => wrongPin.verifyBundle(dir, manifest, entryPath),
    /checksum does not match the registry/,
  );

  // Unsigned bundles are rejected when signatures are required.
  process.env.DROP_PLUGIN_REQUIRE_SIGNATURE = "true";
  await assert.rejects(
    () =>
      new PluginRegistry([], false).verifyBundle(dir, manifestBase, entryPath),
    /bundle verify-demo is unsigned/,
  );
  delete process.env.DROP_PLUGIN_REQUIRE_SIGNATURE;

  // Tampering with any bundle file fails its declared checksum.
  await fs.writeFile(path.join(dir, "helper.mjs"), "export const value = 2;\n");
  await assert.rejects(
    () => pinned.verifyBundle(dir, manifest, entryPath),
    /bundle file checksum mismatch for helper\.mjs/,
  );
});
