import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  maskConnection,
  resolveDepotToken,
  saveConnection,
  type ConnectionRow,
  type ConnectionStore,
} from "./connections";

function createStore() {
  const rows: ConnectionRow[] = [];
  let seq = 0;
  const store: ConnectionStore = {
    async upsert(row) {
      const existing = rows.find(
        (r) => r.provider === row.provider && r.accountId === row.accountId,
      );
      if (existing) {
        Object.assign(existing, row, { updatedAt: new Date() });
        return { ...existing };
      }
      const created: ConnectionRow = { id: `c${++seq}`, ...row };
      rows.push(created);
      return { ...created };
    },
    async newest(provider) {
      const matches = rows
        .filter((r) => r.provider === provider)
        .sort(
          (a, b) =>
            (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
        );
      return matches[0] ? { ...matches[0] } : null;
    },
    async list() {
      return rows.map((r) => ({ ...r }));
    },
    async remove(id) {
      const index = rows.findIndex((r) => r.id === id);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
    async updateTokens(id, patch) {
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.accessToken = patch.accessToken;
        row.refreshToken = patch.refreshToken ?? null;
        row.expiresAt = patch.expiresAt ?? null;
      }
    },
  };
  return { store, rows };
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockTokenFetch(body: unknown) {
  globalThis.fetch = (async (url: string | URL | Request) => {
    const href = String(url);
    if (href.includes("pids/me"))
      return new Response(JSON.stringify({ person: { pid: 987 } }), {
        status: 200,
      });
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
}

function jwt(claims: Record<string, unknown>) {
  const b64 = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64(claims)}.signature`;
}

test("storing a GOG JWT derives the account id and expiry from its claims", async () => {
  const { store, rows } = createStore();
  const exp = Math.floor(Date.now() / 1000) + 3600;
  await saveConnection(store, {
    provider: "gog",
    accessToken: jwt({ user: "4242", exp }),
  });
  assert.equal(rows[0]?.accountId, "4242");
  assert.ok(rows[0]?.accessToken);
  assert.equal(rows[0]?.expiresAt?.getTime(), exp * 1000);
  const masked = maskConnection(rows[0] as ConnectionRow);
  assert.equal(
    JSON.stringify(masked).includes("ey"),
    false,
    "masked rows must not carry the token",
  );
});

test("storing a non-JWT GOG credential is rejected", async () => {
  const { store } = createStore();
  await assert.rejects(
    () => saveConnection(store, { provider: "gog", accessToken: "opaque" }),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 400,
  );
});

test("storing an Epic refresh token upgrades it to a full token set", async () => {
  mockTokenFetch({
    access_token: "at",
    refresh_token: "rt2",
    expires_in: 7200,
  });
  const { store, rows } = createStore();
  await saveConnection(store, {
    provider: "epic",
    accountId: "acc-1",
    refreshToken: "rt1",
  });
  assert.equal(rows[0]?.accessToken, "at");
  assert.equal(rows[0]?.refreshToken, "rt2");
  assert.ok(rows[0]?.expiresAt && rows[0].expiresAt.getTime() > Date.now());
});

test("storing an EA access token resolves the account pid", async () => {
  mockTokenFetch({});
  const { store, rows } = createStore();
  await saveConnection(store, { provider: "ea", accessToken: "ea-at" });
  assert.equal(rows[0]?.accountId, "987");
});

test("storing Ubisoft credentials keeps the ticket and user id together", async () => {
  const { store, rows } = createStore();
  await saveConnection(store, {
    provider: "ubisoft",
    ticket: "ticket-abc",
    userId: "ubi-user",
  });
  assert.equal(rows[0]?.accessToken, "ticket-abc");
  assert.equal(rows[0]?.accountId, "ubi-user");
});

test("a caller token always wins over stored credentials", async () => {
  const { store } = createStore();
  await saveConnection(store, {
    provider: "gog",
    accessToken: jwt({ user: "1" }),
  });
  const resolved = await resolveDepotToken(store, "gog", "caller-token");
  assert.equal(resolved.token, "caller-token");
});

test("resolution falls back to the stored connection when valid", async () => {
  const { store } = createStore();
  await saveConnection(store, {
    provider: "epic",
    accountId: "acc-9",
    accessToken: "stored-at",
  });
  const resolved = await resolveDepotToken(store, "epic");
  assert.deepEqual(resolved, { token: "stored-at", accountId: "acc-9" });
});

test("an expired Epic connection refreshes and persists the new tokens", async () => {
  mockTokenFetch({
    access_token: "at2",
    refresh_token: "rt3",
    expires_in: 3600,
  });
  const { store, rows } = createStore();
  await saveConnection(store, {
    provider: "epic",
    accountId: "acc-1",
    accessToken: "stale",
    refreshToken: "rt",
  });
  rows[0]!.expiresAt = new Date(Date.now() - 1000);
  const resolved = await resolveDepotToken(store, "epic");
  assert.equal(resolved.token, "at2");
  assert.equal(rows[0]?.accessToken, "at2", "refreshed token must be stored");
  assert.equal(rows[0]?.refreshToken, "rt3");
});

test("an expired connection without a refresh path reports 410", async () => {
  const { store } = createStore();
  await saveConnection(store, {
    provider: "gog",
    accessToken: jwt({ user: "u", exp: Math.floor(Date.now() / 1000) - 5 }),
  });
  await assert.rejects(
    () => resolveDepotToken(store, "gog"),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 410,
  );
});

test("no stored connection asks for a caller token", async () => {
  const { store } = createStore();
  await assert.rejects(
    () => resolveDepotToken(store, "ea"),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 401,
  );
});
