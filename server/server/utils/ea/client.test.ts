import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildEaLoginUrl,
  exchangeEaAuthorizationCode,
  exchangeEaLoginCode,
  exchangeEaSessionCookie,
  extractEaAuthCode,
  getEaEntitlements,
  refreshEaToken,
  searchEaCatalog,
} from "./client";

const originalFetch = globalThis.fetch;

/** EA grants no public clients; tests fake the deployment's confidential one. */
function clearEaClientEnv() {
  delete process.env.EA_OAUTH_CLIENT_ID;
  delete process.env.EA_OAUTH_CLIENT_SECRET;
  delete process.env.EA_OAUTH_REDIRECT_URI;
}

function withEaClientEnv(run: () => Promise<void> | void) {
  const saved = {
    EA_OAUTH_CLIENT_ID: process.env.EA_OAUTH_CLIENT_ID,
    EA_OAUTH_CLIENT_SECRET: process.env.EA_OAUTH_CLIENT_SECRET,
    EA_OAUTH_REDIRECT_URI: process.env.EA_OAUTH_REDIRECT_URI,
  };
  process.env.EA_OAUTH_CLIENT_ID = "confidential-id";
  process.env.EA_OAUTH_CLIENT_SECRET = "confidential-secret";
  process.env.EA_OAUTH_REDIRECT_URI = "https://app.example/callback";
  return (async () => {
    try {
      await run();
    } finally {
      clearEaClientEnv();
      if (saved.EA_OAUTH_CLIENT_ID !== undefined)
        process.env.EA_OAUTH_CLIENT_ID = saved.EA_OAUTH_CLIENT_ID;
      if (saved.EA_OAUTH_CLIENT_SECRET !== undefined)
        process.env.EA_OAUTH_CLIENT_SECRET = saved.EA_OAUTH_CLIENT_SECRET;
      if (saved.EA_OAUTH_REDIRECT_URI !== undefined)
        process.env.EA_OAUTH_REDIRECT_URI = saved.EA_OAUTH_REDIRECT_URI;
    }
  })();
}
const calls: { url: string; init: RequestInit }[] = [];
function mockFetch(status: number, body: unknown) {
  calls.length = 0;
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearEaClientEnv();
});

test("exchanges EA authorization code with form fields and client auth", async () => {
  mockFetch(200, {
    access_token: "access",
    refresh_token: "refresh",
    expires_in: 3600,
  });
  const token = await exchangeEaAuthorizationCode(
    "code-value",
    "https://app.example/callback",
    "client",
    "secret",
  );
  assert.equal(token.access_token, "access");
  assert.equal(calls[0].url, "https://accounts.ea.com/connect/token");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(
    headers.Authorization,
    `Basic ${Buffer.from("client:secret").toString("base64")}`,
  );
  assert.match(String(calls[0].init.body), /grant_type=authorization_code/);
});

test("refreshes EA tokens and accepts rotated refresh token", async () => {
  mockFetch(200, {
    access_token: "new-access",
    refresh_token: "rotated",
    expires_in: 1800,
  });
  const token = await refreshEaToken("old-refresh", "client", "secret");
  assert.equal(token.refresh_token, "rotated");
  assert.match(String(calls[0].init.body), /grant_type=refresh_token/);
});

test("no EA sign-in URL is offered without a configured OAuth client", () => {
  clearEaClientEnv();
  assert.equal(buildEaLoginUrl(), null);
});

test("builds an EA sign-in URL from the configured confidential client", async () => {
  await withEaClientEnv(() => {
    const url = buildEaLoginUrl();
    assert.ok(url);
    const parsed = new URL(url);
    assert.equal(
      parsed.origin + parsed.pathname,
      "https://accounts.ea.com/connect/auth",
    );
    assert.equal(parsed.searchParams.get("client_id"), "confidential-id");
    assert.equal(
      parsed.searchParams.get("redirect_uri"),
      "https://app.example/callback",
    );
    assert.equal(parsed.searchParams.get("response_type"), "code");
  });
});

test("sign-in codes redeem only under the configured client's Basic auth", async () => {
  await withEaClientEnv(async () => {
    mockFetch(200, {
      access_token: "ea-access",
      refresh_token: "ea-refresh",
      expires_in: 7200,
    });
    const token = await exchangeEaLoginCode("  abc-123  ");
    assert.equal(token.access_token, "ea-access");
    assert.equal(calls[0].url, "https://accounts.ea.com/connect/token");
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(
      headers.Authorization,
      `Basic ${Buffer.from("confidential-id:confidential-secret").toString("base64")}`,
    );
    const body = new URLSearchParams(String(calls[0].init.body));
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(body.get("code"), "abc-123");
    assert.equal(body.get("redirect_uri"), "https://app.example/callback");
  });
});

test("a custom-scheme redirect link is reduced to its code", async () => {
  await withEaClientEnv(async () => {
    mockFetch(200, { access_token: "x", expires_in: 1 });
    await exchangeEaLoginCode("ea-desktop://callback?code=deadbeef&state=abc");
    const body = new URLSearchParams(String(calls[0].init.body));
    assert.equal(body.get("code"), "deadbeef");
  });
  assert.equal(extractEaAuthCode(" plain-code "), "plain-code");
});

test("without a configured client, code exchange says so clearly", async () => {
  clearEaClientEnv();
  mockFetch(200, { access_token: "x", expires_in: 1 });
  await assert.rejects(
    () => exchangeEaLoginCode("abc-123"),
    (err: unknown) => {
      const e = err as { statusCode?: number; statusMessage?: string };
      assert.equal(e.statusCode, 400);
      assert.match(e.statusMessage ?? "", /EA_OAUTH_CLIENT_ID/);
      assert.equal(calls.length, 0, "must not call EA with a made-up client");
      return true;
    },
  );
});

test("shapes EA entitlement response", async () => {
  mockFetch(200, { entitlements: [{ offerId: "OFFER-1" }] });
  const result = await getEaEntitlements("bearer", 0, 100);
  assert.deepEqual(result, [{ offerId: "OFFER-1" }]);
  assert.match(calls[0].url, /count=100/);
});

test("shapes Juno GraphQL catalog product list", async () => {
  mockFetch(200, {
    data: {
      offers: [{ offerId: "OFFER-1", offerName: "Game" }, { invalid: true }],
    },
  });
  const products = await searchEaCatalog("bearer", "sample game");
  assert.deepEqual(products, [{ offerId: "OFFER-1", offerName: "Game" }]);
  assert.equal(
    (calls[0].init.headers as Record<string, string>).Authorization,
    "Bearer bearer",
  );
});

function sessionJwt(secondsFromNow: number): string {
  const b64 = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ exp: Math.floor(Date.now() / 1000) + secondsFromNow })}.sig`;
}

test("an ea.com sid cookie exchanges for an EA JWT at EA's identity endpoint", async () => {
  const token = sessionJwt(3600);
  mockFetch(200, { data: { jwt: token, user_id: 123456 } });
  const session = await exchangeEaSessionCookie("  cookie-value  ");
  assert.equal(session.jwt, token);
  assert.equal(session.userId, "123456");
  assert.ok(session.expiresAt && session.expiresAt.getTime() > Date.now());
  assert.match(calls[0].url, /signin\.ea\.com\/p\/identitynucleus\/xhr\/auth/);
  assert.equal(
    (calls[0].init.headers as Record<string, string>).Cookie,
    "sid=cookie-value",
  );
});

test("a top-level token field is accepted too", async () => {
  mockFetch(200, { token: sessionJwt(60) });
  const session = await exchangeEaSessionCookie("c");
  assert.match(session.jwt, /^eyJ/);
});

test("an empty session answer (dead cookie) is reported as a sign-in failure", async () => {
  mockFetch(200, {});
  await assert.rejects(
    () => exchangeEaSessionCookie("stale-cookie"),
    (error: unknown) => {
      const e = error as { statusCode?: number; statusMessage?: string };
      assert.equal(e.statusCode, 401);
      assert.match(e.statusMessage ?? "", /sign in to ea\.com/i);
      return true;
    },
  );
});

test("an empty cookie never reaches EA", async () => {
  mockFetch(200, {});
  await assert.rejects(
    () => exchangeEaSessionCookie("   "),
    (error: unknown) =>
      (error as { statusCode?: number }).statusCode === 400 &&
      calls.length === 0,
  );
});
