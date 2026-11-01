import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildGogAuthorizeUrl, exchangeGogAuthorizationCode } from "./gog";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("the GOG authorize URL uses the public Galaxy client and state", () => {
  const url = new URL(
    buildGogAuthorizeUrl(
      "http://localhost:4000/api/admin/depot/connection/gog/callback",
      "state-123",
    ),
  );
  assert.equal(url.origin + url.pathname, "https://auth.gog.com/auth");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "state-123");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "http://localhost:4000/api/admin/depot/connection/gog/callback",
  );
});

test("the code exchange posts the code to GOG's token endpoint", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return new Response(
      JSON.stringify({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        user_id: "999",
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const tokens = await exchangeGogAuthorizationCode(
    "the-code",
    "http://localhost:4000/cb",
  );
  assert.equal(tokens.user_id, "999");
  const sent = new URL(calls[0] as string);
  assert.equal(sent.origin + sent.pathname, "https://auth.gog.com/token");
  assert.equal(sent.searchParams.get("grant_type"), "authorization_code");
  assert.equal(sent.searchParams.get("code"), "the-code");
});
