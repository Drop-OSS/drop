import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildGogAuthorizeUrl,
  exchangeGogAuthorizationCode,
  extractGogAuthCode,
} from "./gog";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("the GOG authorize URL uses the Heroic client and its registered redirect", () => {
  const url = new URL(buildGogAuthorizeUrl());
  assert.equal(url.origin + url.pathname, "https://auth.gog.com/auth");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("layout"), "galaxy");
  // GOG rejects any other client/redirect combo with "invalid client".
  assert.equal(url.searchParams.get("client_id"), "46899977096215655");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://embed.gog.com/on_login_success?origin=client",
  );
});

test("a full embed sign-in URL is reduced to its code", () => {
  assert.equal(
    extractGogAuthCode(
      "https://embed.gog.com/on_login_success?origin=client&code=abc-123",
    ),
    "abc-123",
  );
  assert.equal(extractGogAuthCode(" abc-123 "), "abc-123");
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
    "https://embed.gog.com/on_login_success?origin=client&code=the-code",
  );
  assert.equal(tokens.user_id, "999");
  const sent = new URL(calls[0] as string);
  assert.equal(sent.origin + sent.pathname, "https://auth.gog.com/token");
  assert.equal(sent.searchParams.get("grant_type"), "authorization_code");
  assert.equal(sent.searchParams.get("code"), "the-code");
  assert.equal(
    sent.searchParams.get("redirect_uri"),
    "https://embed.gog.com/on_login_success?origin=client",
  );
});
