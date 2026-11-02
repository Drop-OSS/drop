import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  isUbisoftTwoFactorChallenge,
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
  delete process.env.EA_OAUTH_CLIENT_ID;
  delete process.env.EA_OAUTH_CLIENT_SECRET;
  delete process.env.EA_OAUTH_REDIRECT_URI;
});

/** EA has no public OAuth client; tests opt into a configured one. */
function setEaClientEnv() {
  process.env.EA_OAUTH_CLIENT_ID = "confidential-id";
  process.env.EA_OAUTH_CLIENT_SECRET = "confidential-secret";
  process.env.EA_OAUTH_REDIRECT_URI = "https://app.example/callback";
}

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

test("storing an opaque GOG token without an account id is rejected", async () => {
  const { store } = createStore();
  await assert.rejects(
    () => saveConnection(store, { provider: "gog", accessToken: "opaque" }),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 400,
  );
});

test("storing an opaque GOG token with an explicit account id works", async () => {
  const { store, rows } = createStore();
  await saveConnection(store, {
    provider: "gog",
    accessToken: "opaque-launcher-token",
    accountId: "9900112233445566",
  });
  assert.equal(rows[0]?.accountId, "9900112233445566");
  assert.equal(rows[0]?.expiresAt, null);
});

test("a GOG sign-in code upgrades to a stored token set", async () => {
  mockQueueFetch([
    {
      body: {
        access_token: "gog-at",
        refresh_token: "gog-rt",
        expires_in: 7200,
        user_id: "9900112233445566",
      },
    },
  ]);
  const { store, rows } = createStore();
  await saveConnection(store, {
    provider: "gog",
    code: "https://embed.gog.com/on_login_success?origin=client&code=abc-123",
  });
  assert.equal(rows[0]?.accessToken, "gog-at");
  assert.equal(rows[0]?.refreshToken, "gog-rt");
  assert.equal(rows[0]?.accountId, "9900112233445566");
  assert.ok(rows[0]?.expiresAt && rows[0].expiresAt.getTime() > Date.now());
});

test("an expired GOG connection renews itself from the refresh token", async () => {
  mockTokenFetch({
    access_token: "fresh-opaque-token",
    refresh_token: "rt-next",
    expires_in: 7200,
  });
  const { store, rows } = createStore();
  await saveConnection(store, {
    provider: "gog",
    accessToken: "stale-token",
    refreshToken: "rt",
    accountId: "777",
  });
  rows[0]!.expiresAt = new Date(Date.now() - 1000);
  const resolved = await resolveDepotToken(store, "gog");
  assert.equal(resolved.token, "fresh-opaque-token");
  assert.equal(rows[0]?.refreshToken, "rt-next");
});

test("an Epic connection derives the account id from the redeemed token", async () => {
  mockTokenFetch({
    access_token: "at",
    refresh_token: "rt2",
    expires_in: 3600,
    account_id: "epic-acc-77",
  });
  const { store, rows } = createStore();
  await saveConnection(store, { provider: "epic", refreshToken: "rt1" });
  assert.equal(rows[0]?.accountId, "epic-acc-77");
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

test("an EA sign-in code upgrades with the configured client", async () => {
  setEaClientEnv();
  mockQueueFetch([
    {
      body: {
        access_token: "ea-at",
        refresh_token: "ea-rt",
        expires_in: 7200,
      },
    },
    { body: { person: { pid: 4242 } } },
  ]);
  const { store, rows } = createStore();
  await saveConnection(store, {
    provider: "ea",
    code: "https://app.example/callback?code=xyz&state=1",
  });
  assert.equal(rows[0]?.accessToken, "ea-at");
  assert.equal(rows[0]?.refreshToken, "ea-rt");
  assert.equal(rows[0]?.accountId, "4242");
});

test("an EA sign-in code without a configured client fails honestly", async () => {
  mockQueueFetch([{ status: 400, body: { error: "invalid_client" } }]);
  const { store, rows } = createStore();
  await assert.rejects(
    () => saveConnection(store, { provider: "ea", code: "abc-123" }),
    (err: unknown) => {
      const e = err as { statusCode?: number; statusMessage?: string };
      assert.equal(e.statusCode, 400);
      assert.match(e.statusMessage ?? "", /EA_OAUTH_CLIENT_ID/);
      return true;
    },
  );
  assert.equal(rows.length, 0);
});

test("an EA refresh token upgrades with the configured client", async () => {
  setEaClientEnv();
  mockTokenFetch({
    access_token: "at",
    refresh_token: "rt2",
    expires_in: 3600,
  });
  const { store, rows } = createStore();
  await saveConnection(store, { provider: "ea", refreshToken: "rt1" });
  assert.equal(rows[0]?.accessToken, "at");
  assert.equal(rows[0]?.refreshToken, "rt2");
});

test("an EA refresh without a configured client is refused, not guessed", async () => {
  mockQueueFetch([{ status: 400, body: { error: "invalid_client" } }]);
  const { store } = createStore();
  await assert.rejects(
    () => saveConnection(store, { provider: "ea", refreshToken: "rt1" }),
    (err: unknown) => {
      const e = err as { statusCode?: number; statusMessage?: string };
      assert.equal(e.statusCode, 400);
      assert.match(e.statusMessage ?? "", /EA_OAUTH_CLIENT_ID/);
      return true;
    },
  );
});

test("an expired EA connection cannot self-renew without a configured client", async () => {
  mockQueueFetch([{ status: 400, body: { error: "invalid_client" } }]);
  const { store, rows } = createStore();
  await saveConnection(store, {
    provider: "ea",
    accessToken: "stale",
    refreshToken: "rt",
    accountId: "55",
  });
  rows[0]!.expiresAt = new Date(Date.now() - 1000);
  // No env: refresh is impossible, so resolve reports "reconnect" (410)
  // instead of firing a request at a client EA would reject.
  await assert.rejects(
    () => resolveDepotToken(store, "ea"),
    (err: unknown) => {
      assert.equal((err as { statusCode?: number }).statusCode, 410);
      return true;
    },
  );
});

test("an expired EA connection refreshes with the configured client", async () => {
  const { store, rows } = createStore();
  await saveConnection(store, {
    provider: "ea",
    accessToken: "stale",
    refreshToken: "rt",
    accountId: "55",
  });
  rows[0]!.expiresAt = new Date(Date.now() - 1000);
  setEaClientEnv();
  mockTokenFetch({
    access_token: "at2",
    refresh_token: "rt3",
    expires_in: 3600,
  });
  const resolved = await resolveDepotToken(store, "ea");
  assert.equal(resolved.token, "at2");
  assert.equal(rows[0]?.refreshToken, "rt3");
});

function mockQueueFetch(
  responses: { status?: number; body?: unknown }[],
): void {
  let index = 0;
  globalThis.fetch = (async () => {
    const responder = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return new Response(JSON.stringify(responder?.body ?? {}), {
      status: responder?.status ?? 200,
    });
  }) as typeof fetch;
}

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

test("Ubisoft email login stores ticket and remember-me ticket, never the password", async () => {
  mockQueueFetch([
    {
      body: {
        ticket: "ubi-t1",
        sessionId: "s-1",
        userId: "ubi-9",
        rememberMeTicket: "rm-1",
        expiration: "2030-01-01T00:00:00Z",
        profiles: [{ nameOnPlatform: "PlayerOne" }],
      },
    },
  ]);
  const { store, rows } = createStore();
  await saveConnection(store, {
    provider: "ubisoft",
    email: "player@example.com",
    password: "swordfish",
  });
  assert.equal(rows[0]?.accountId, "ubi-9");
  assert.equal(rows[0]?.accessToken, "ubi-t1");
  assert.equal(rows[0]?.refreshToken, "rm-1");
  assert.equal(rows[0]?.username, "PlayerOne");
  assert.ok(rows[0]?.expiresAt && rows[0].expiresAt.getTime() > Date.now());
  assert.ok(
    !JSON.stringify(rows).includes("swordfish"),
    "the password must never reach the store",
  );
});

test("a Ubisoft 2FA challenge comes back as a challenge, not an error", async () => {
  mockQueueFetch([
    {
      body: {
        twoFactorAuthenticationTicket: "2fa-x",
        twoFactorAuthenticationMethod: "email",
      },
    },
  ]);
  const { store, rows } = createStore();
  // The challenge travels in a normal 200 response: error bodies lose
  // custom fields in production, and the ticket must survive to the UI.
  const result = await saveConnection(store, {
    provider: "ubisoft",
    email: "player@example.com",
    password: "pw",
  });
  assert.ok(isUbisoftTwoFactorChallenge(result));
  assert.equal(result.twoFactorTicket, "2fa-x");
  assert.equal(result.method, "email");
  assert.equal(rows.length, 0, "a pending 2FA must not store a connection");
});

test("a Ubisoft 2FA completion stores the resulting session", async () => {
  mockQueueFetch([
    {
      body: {
        ticket: "ubi-t2",
        sessionId: "s-2",
        userId: "ubi-9",
        rememberMeTicket: "rm-2",
      },
    },
  ]);
  const { store, rows } = createStore();
  await saveConnection(store, {
    provider: "ubisoft",
    code: "654321",
    twoFactorTicket: "2fa-x",
  });
  assert.equal(rows[0]?.accessToken, "ubi-t2");
  assert.equal(rows[0]?.refreshToken, "rm-2");
  assert.ok(
    rows[0]?.expiresAt && rows[0].expiresAt.getTime() > Date.now(),
    "a session without an expiration gets a conservative renewal horizon",
  );
});

test("an expired Ubisoft connection re-opens with its remember-me ticket", async () => {
  mockQueueFetch([
    {
      body: {
        ticket: "ubi-t1",
        userId: "ubi-9",
        rememberMeTicket: "rm-1",
        expiration: "2000-01-01T00:00:00Z",
      },
    },
    {
      body: {
        ticket: "ubi-t2",
        userId: "ubi-9",
        rememberMeTicket: "rm-2",
        expiration: "2030-01-01T00:00:00Z",
      },
    },
  ]);
  const { store, rows } = createStore();
  await saveConnection(store, {
    provider: "ubisoft",
    email: "player@example.com",
    password: "pw",
  });
  const resolved = await resolveDepotToken(store, "ubisoft");
  assert.equal(resolved.token, "ubi-t2");
  assert.equal(rows[0]?.accessToken, "ubi-t2", "the fresh ticket must be kept");
  assert.equal(rows[0]?.refreshToken, "rm-2", "Ubisoft rotates the rm ticket");
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
