import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildGogAuthorizeUrl,
  exchangeGogAuthorizationCode,
  extractGogAuthCode,
  getGogLibrary,
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

test("the library uses the Bearer header and shapes products with platforms", async () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(
      JSON.stringify({
        totalPages: 1,
        products: [
          {
            id: 1711765822,
            title: "Timberborn",
            worksOn: { Windows: true, Mac: true, Linux: false },
          },
          { id: "junk", title: "Broken entry" },
        ],
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const games = await getGogLibrary("token-123");
  assert.match(calls[0]!.url, /account\/getFilteredProducts/);
  assert.equal(calls[0]!.headers.Authorization, "Bearer token-123");
  assert.equal(games.length, 1, "invalid ids are dropped");
  assert.equal(games[0]?.id, "1711765822");
  assert.equal(games[0]?.title, "Timberborn");
  assert.deepEqual(games[0]?.worksOn, ["windows", "mac"]);
});

test("a login-page redirect from the library means the token is dead", async () => {
  globalThis.fetch = (async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://gog.com/login" },
    })) as typeof fetch;
  await assert.rejects(
    () => getGogLibrary("expired-token"),
    (err: unknown) => {
      const e = err as { statusCode?: number; statusMessage?: string };
      assert.equal(e.statusCode, 403);
      assert.match(e.statusMessage ?? "", /rejected the access token/);
      return true;
    },
  );
});

test("library pages are followed until totalPages", async () => {
  let pages = 0;
  globalThis.fetch = (async (url: string | URL | Request) => {
    pages += 1;
    const page = new URL(String(url)).searchParams.get("page");
    return new Response(
      JSON.stringify({
        totalPages: 2,
        products: [{ id: 100 + Number(page), title: `Game ${page}` }],
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const games = await getGogLibrary("token");
  assert.equal(pages, 2);
  assert.deepEqual(
    games.map((g) => g.title),
    ["Game 1", "Game 2"],
  );
});
