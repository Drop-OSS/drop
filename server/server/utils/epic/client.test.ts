import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEpicAuthCodeLoginUrl,
  exchangeEpicAuthCode,
  extractEpicAuthCode,
  refreshEpicToken,
  getEpicEntitlements,
  getEpicAssetInfo,
  normalizeEpicEntitlements,
  isEpicRuntimeEntitlement,
  isEpicGameEntitlement,
  collectEpicCatalogNameTargets,
  getEpicCatalogItemNames,
  getEpicLibraryItems,
  normalizeEpicLibraryItems,
} from "./client.js";

/** Assert an h3-style typed error: a status code and, optionally, a message fragment. */
function typedError(statusCode: number, message?: RegExp) {
  return (error: unknown): boolean => {
    const thrown = error as {
      statusCode?: number;
      statusMessage?: string;
      message?: string;
    } | null;
    const text = thrown?.statusMessage ?? thrown?.message ?? "";
    return (
      thrown?.statusCode === statusCode &&
      (message === undefined || message.test(text))
    );
  };
}

test("Epic Client Integration & Mock Suite", async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test(
    "exchangeEpicAuthCode: succeeds and returns tokens on valid auth code",
    async () => {
      globalThis.fetch = async (url, init) => {
        assert.match(String(url), /oauth\/token/);
        assert.equal(init?.method, "POST");
        const headers = init?.headers as Record<string, string>;
        assert.ok(headers.Authorization.startsWith("Basic "));
        assert.equal(
          headers["Content-Type"],
          "application/x-www-form-urlencoded",
        );

        const body = new URLSearchParams(init?.body as string);
        assert.equal(body.get("grant_type"), "authorization_code");
        assert.equal(body.get("code"), "valid-test-code");

        return new Response(
          JSON.stringify({
            access_token: "mock-access-token-123",
            refresh_token: "mock-refresh-token-456",
            expires_in: 3600,
            account_id: "test-epic-account-id",
            token_type: "bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      const result = await exchangeEpicAuthCode("valid-test-code");
      assert.equal(result.access_token, "mock-access-token-123");
      assert.equal(result.refresh_token, "mock-refresh-token-456");
      assert.equal(result.account_id, "test-epic-account-id");
      assert.equal(result.expires_in, 3600);
    },
  );

  await t.test(
    "exchangeEpicAuthCode: throws 400 when code is invalid or expired",
    async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            errorCode:
              "errors.com.epicgames.account.oauth.authorization_code_not_found",
            errorMessage: "Authorization code is invalid or has expired",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      };

      await assert.rejects(async () => {
        await exchangeEpicAuthCode("invalid-code");
      }, typedError(400));
    },
  );

  await t.test(
    "exchangeEpicAuthCode: throws 502 when Epic auth endpoint fails to respond",
    async () => {
      globalThis.fetch = async () => {
        throw new Error("Network timeout / connection reset");
      };

      await assert.rejects(async () => {
        await exchangeEpicAuthCode("any-code");
      }, typedError(502));
    },
  );

  await t.test(
    "refreshEpicToken: refreshes expired access token successfully",
    async () => {
      globalThis.fetch = async (url, init) => {
        assert.match(String(url), /oauth\/token/);
        const body = new URLSearchParams(init?.body as string);
        assert.equal(body.get("grant_type"), "refresh_token");
        assert.equal(body.get("refresh_token"), "valid-refresh-token");

        return new Response(
          JSON.stringify({
            access_token: "new-access-token-789",
            refresh_token: "new-refresh-token-012",
            expires_in: 7200,
            account_id: "test-epic-account-id",
            token_type: "bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      const result = await refreshEpicToken("valid-refresh-token");
      assert.equal(result.access_token, "new-access-token-789");
      assert.equal(result.refresh_token, "new-refresh-token-012");
      assert.equal(result.expires_in, 7200);
    },
  );

  await t.test(
    "getEpicEntitlements: parses paginated library items",
    async () => {
      const mockEntitlements = [
        {
          id: "ent-1",
          entitlementName: "Fortnite",
          namespace: "fn",
          catalogItemId: "catalog-item-1",
          grantDate: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "ent-2",
          entitlementName: "Alan Wake 2",
          namespace: "aw2",
          catalogItemId: "catalog-item-2",
          grantDate: "2024-02-01T00:00:00.000Z",
        },
      ];

      globalThis.fetch = async (url, init) => {
        assert.match(
          String(url),
          /entitlement\/api\/account\/test-acc\/entitlements/,
        );
        const headers = init?.headers as Record<string, string>;
        assert.equal(headers.Authorization, "Bearer mock-jwt-token");

        return new Response(JSON.stringify(mockEntitlements), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const entitlements = await getEpicEntitlements(
        "test-acc",
        "mock-jwt-token",
      );
      assert.equal(entitlements.length, 2);
      assert.equal(entitlements[0].entitlementName, "Fortnite");
      assert.equal(entitlements[1].entitlementName, "Alan Wake 2");
    },
  );

  await t.test(
    "getEpicAssetInfo: returns asset details when game build is found",
    async () => {
      const mockAsset = {
        appName: "FortniteApp",
        catalogItemId: "catalog-item-1",
        namespace: "fn",
        buildVersion: "28.00.0",
        distributionPoint: "https://cdn.epicgames.com/builds",
        manifestHash: "sha256-dummy-hash",
      };

      globalThis.fetch = async (url, init) => {
        assert.match(
          String(url),
          /launcher\/api\/public\/assets\/v2\/platform\/Windows/,
        );
        assert.match(String(url), /namespace=fn/);
        assert.match(String(url), /catalogItemId=catalog-item-1/);
        assert.match(String(url), /appName=FortniteApp/);
        const headers = init?.headers as Record<string, string>;
        assert.equal(headers.Authorization, "Bearer mock-jwt-token");

        return new Response(JSON.stringify({ elements: [mockAsset] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const asset = await getEpicAssetInfo(
        "Windows",
        "fn",
        "catalog-item-1",
        "FortniteApp",
        "mock-jwt-token",
      );
      assert.ok(asset);
      assert.equal(asset.appName, "FortniteApp");
      assert.equal(asset.buildVersion, "28.00.0");
      assert.equal(asset.distributionPoint, "https://cdn.epicgames.com/builds");
    },
  );

  await t.test("getEpicAssetInfo: returns null on 404 not found", async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ errorCode: "NOT_FOUND" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    };

    const asset = await getEpicAssetInfo(
      "Windows",
      "fn",
      "non-existent",
      "App",
      "mock-jwt-token",
    );
    assert.equal(asset, null);
  });
});

test("the Epic login URL points at the launcher client's code redirect", () => {
  const url = new URL(buildEpicAuthCodeLoginUrl());
  assert.equal(url.origin + url.pathname, "https://www.epicgames.com/id/login");
  const redirect = new URL(url.searchParams.get("redirectUrl") as string);
  assert.equal(
    redirect.origin + redirect.pathname,
    "https://www.epicgames.com/id/api/redirect",
  );
  assert.equal(
    redirect.searchParams.get("clientId"),
    "34a02cf8f4414e29b15921876da36f9a",
  );
  assert.equal(redirect.searchParams.get("responseType"), "code");
});

test("extractEpicAuthCode accepts code, URL, or the full pasted JSON page", () => {
  assert.equal(extractEpicAuthCode("  bare-code "), "bare-code");
  assert.equal(
    extractEpicAuthCode("https://www.epicgames.com/id/api/redirect?code=xyz-1"),
    "xyz-1",
  );
  assert.equal(
    extractEpicAuthCode(
      '{"code":"json-code","sid":"s","prefix":"p","correlationId":"c"}',
    ),
    "json-code",
  );
});

test("an error page JSON (correlationId, no code) explains itself", () => {
  assert.throws(
    () =>
      extractEpicAuthCode('{"error":"invalid_request","correlationId":"abc"}'),
    (error: unknown) => {
      const e = error as { statusCode?: number; statusMessage?: string };
      return (
        e.statusCode === 400 && /correlationId abc/.test(e.statusMessage ?? "")
      );
    },
  );
});

test("the code exchange asks for the eg1 token type", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      const body = new URLSearchParams(init?.body as string);
      assert.equal(body.get("token_type"), "eg1");
      return new Response(
        JSON.stringify({
          access_token: "a",
          refresh_token: "r",
          expires_in: 60,
          account_id: "acc",
          token_type: "bearer",
        }),
        { status: 200 },
      );
    };
    const tokens = await exchangeEpicAuthCode("some-code");
    assert.equal(tokens.account_id, "acc");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epic's errorCode/errorMessage reach the user verbatim", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          errorCode: "errors.com.epicgames.oauth.invalid_code",
          errorMessage: "Authorization code is invalid",
        }),
        { status: 400 },
      );
    await assert.rejects(
      () => exchangeEpicAuthCode("burned-code"),
      typedError(400, /Authorization code is invalid/),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epic entitlements normalize to human names, not catalog hashes", () => {
  const rows = normalizeEpicEntitlements([
    {
      id: "e1",
      // The base-game shape that used to show as the title: Epic's own
      // machine slug, the catalog item id verbatim.
      entitlementName: "7ce1367f0ee846418b236dfe96d30c2c",
      namespace: "f9a9",
      catalogItemId: "7ce1367f0ee846418b236dfe96d30c2c",
      grantDate: "2024-01-02T00:00:00Z",
      displayName: "Death Stranding Director's Edition",
    },
    {
      id: "e2",
      entitlementName: "AnOldTitleWithNoDisplayName",
      namespace: "other",
      catalogItemId: "ff00ff00ff00ff00ff00ff00ff00ff00",
      grantDate: "2020-05-05T00:00:00Z",
    },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.title, "Death Stranding Director's Edition");
  // The ingest call needs an appName and entitlements do not carry one;
  // for UE-format titles it is the catalog item id.
  assert.equal(rows[0]?.appName, "7ce1367f0ee846418b236dfe96d30c2c");
  // With no displayName the slug is all Epic said; it stays the fallback.
  assert.equal(rows[1]?.title, "AnOldTitleWithNoDisplayName");
});

test("the launcher and engine runtimes are not titles", () => {
  assert.equal(
    isEpicRuntimeEntitlement({ entitlementName: "EpicGamesLauncher" }),
    true,
  );
  assert.equal(isEpicRuntimeEntitlement({ entitlementName: "UE_5.3" }), true);
  assert.equal(isEpicRuntimeEntitlement({ namespace: "ue" }), true);
  assert.equal(
    isEpicRuntimeEntitlement({
      entitlementName: "7ce1367f0ee846418b236dfe96d30c2c",
      namespace: "f9a9",
    }),
    false,
  );

  const rows = normalizeEpicEntitlements([
    {
      id: "r1",
      entitlementName: "UE_4.27",
      namespace: "ue",
      catalogItemId: "deadbeef",
      grantDate: "",
    },
    {
      id: "g1",
      entitlementName: "f9a9item",
      namespace: "f9a9",
      catalogItemId: "f9a9item",
      grantDate: "",
      displayName: "A Real Game",
    },
  ]);
  assert.deepEqual(
    rows.map((row) => row.title),
    ["A Real Game"],
  );
});

test("grant types decide listability, not names", () => {
  // A live account carried 42 AUDIENCE reward rows among 100 entitlements,
  // many under plausible-looking names; only the type can catch them.
  const listable = (
    entitlementType: string,
    entitlementName = "WhateverIsEntitled",
  ) =>
    isEpicGameEntitlement({
      entitlementName,
      namespace: "annamespace",
      entitlementType,
    });
  assert.equal(listable("EXECUTABLE"), true);
  assert.equal(listable("BASE_GAME"), true);
  assert.equal(listable("ADDON"), true);
  assert.equal(listable("AUDIENCE"), false);
  assert.equal(listable("TRIAL"), false);
  // Older payloads carry no type at all; those stay and the runtime
  // filter still applies.
  assert.equal(
    isEpicGameEntitlement({ entitlementName: "UE_5.0", entitlementType: "" }),
    false,
  );
});

test("catalog name targets are only the unnamed listable items", () => {
  const targets = collectEpicCatalogNameTargets([
    {
      id: "1",
      entitlementName: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      namespace: "ns_target",
      catalogItemId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      grantDate: "",
      entitlementType: "EXECUTABLE",
    },
    {
      // Same item granted twice: one lookup.
      id: "2",
      entitlementName: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      namespace: "ns_target",
      catalogItemId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      grantDate: "",
      entitlementType: "EXECUTABLE",
    },
    {
      id: "3",
      entitlementName: "AlreadyNamed",
      namespace: "ns_named",
      catalogItemId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      grantDate: "",
      entitlementType: "EXECUTABLE",
      displayName: "Epic Was Nice Here",
    },
    {
      id: "4",
      entitlementName: "SomeReward",
      namespace: "ns_dropped",
      catalogItemId: "cccccccccccccccccccccccccccccccc",
      grantDate: "",
      entitlementType: "AUDIENCE",
    },
  ]);
  assert.deepEqual(
    [...targets.entries()],
    [["ns_target", ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]]],
  );
});

/** Run `fn` with fetch mocked, restoring the original afterwards. */
async function withFetchMock(
  handler: (url: string) => Response,
  fn: (calls: { urls: string[] }) => Promise<void>,
) {
  const original = globalThis.fetch;
  const calls: { urls: string[] } = { urls: [] };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.urls.push(url);
    return handler(url);
  }) as typeof fetch;
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = original;
  }
}

test("catalog names come from the bulk lookup, productName first", async () => {
  await withFetchMock(
    (url) => {
      const u = new URL(url);
      assert.equal(
        u.pathname,
        "/catalog/api/shared/namespace/ns_catalog/bulk/items",
      );
      // Singular `id` params: the plural `ids=` answers an empty object.
      assert.deepEqual(u.searchParams.getAll("id"), [
        "11111111111111111111111111111111",
        "22222222222222222222222222222222",
      ]);
      return new Response(
        JSON.stringify({
          // Response is keyed by catalog item id.
          "11111111111111111111111111111111": {
            title: "Catalog Title",
            productName: "The Rendered Name",
            appName: "CatalogAppName",
          },
          "22222222222222222222222222222222": { title: "Title Only" },
        }),
        { status: 200 },
      );
    },
    async (calls) => {
      const names = await getEpicCatalogItemNames(
        new Map([
          [
            "ns_catalog",
            [
              "11111111111111111111111111111111",
              "22222222222222222222222222222222",
            ],
          ],
        ]),
        "token",
      );
      assert.equal(calls.urls.length, 1, "one call for one namespace");
      assert.equal(
        names["11111111111111111111111111111111"]?.title,
        "The Rendered Name",
      );
      assert.equal(
        names["11111111111111111111111111111111"]?.appName,
        "CatalogAppName",
      );
      assert.equal(
        names["22222222222222222222222222222222"]?.title,
        "Title Only",
      );

      // Second resolution of the same ids: served from cache, no fetch.
      const again = await getEpicCatalogItemNames(
        new Map([
          [
            "ns_catalog",
            [
              "11111111111111111111111111111111",
              "22222222222222222222222222222222",
            ],
          ],
        ]),
        "token",
      );
      assert.equal(calls.urls.length, 1, "the cache served the repeat");
      assert.equal(
        again["22222222222222222222222222222222"]?.title,
        "Title Only",
      );
    },
  );
});

test("a failing catalog service never fails the library", async () => {
  await withFetchMock(
    () => new Response("rate limited", { status: 429 }),
    async (calls) => {
      const names = await getEpicCatalogItemNames(
        new Map([["ns_failing", ["33333333333333333333333333333333"]]]),
        "token",
      );
      assert.deepEqual(names, {});

      // And the rows that fall back are exactly the ones Epic left nameless.
      const rows = normalizeEpicEntitlements(
        [
          {
            id: "1",
            entitlementName: "33333333333333333333333333333333",
            namespace: "ns_failing",
            catalogItemId: "33333333333333333333333333333333",
            grantDate: "",
            entitlementType: "EXECUTABLE",
          },
        ],
        names,
      );
      assert.equal(rows[0]?.title, "33333333333333333333333333333333");
      assert.equal(calls.urls.length, 1, "no hammering a rate-limited service");
    },
  );
});

test("library items follow Epic's cursors and collapse to products", async () => {
  await withFetchMock(
    (url) => {
      const u = new URL(url);
      assert.equal(u.pathname, "/library/api/public/items");
      if (!u.searchParams.get("cursor")) {
        return new Response(
          JSON.stringify({
            records: [
              {
                namespace: "ns_libclient",
                catalogItemId: "d1d1d1d1d1d1d1d1d1d1d1d1d1d1d101",
                appName: "Libclient",
                sandboxName: "Subnautica",
                platform: "Windows",
              },
            ],
            responseMetadata: { nextCursor: "CURSOR-2" },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          records: [
            {
              namespace: "ns_libclient",
              catalogItemId: "d1d1d1d1d1d1d1d1d1d1d1d1d1d1d101",
              appName: "Libclient",
              sandboxName: "Subnautica",
              platform: "Win32",
            },
            {
              namespace: "ut",
              catalogItemId: "b8538c739273426aa35a98220e258d55",
              appName: "UnrealTournamentDev",
              sandboxName: "Unreal Tournament",
              platform: "Windows,Mac",
            },
            {
              namespace: "ue",
              catalogItemId: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
              appName: "UE_5.4",
              sandboxName: "Unreal Engine",
              platform: "Windows",
            },
            {
              namespace: "somehexnamespace",
              catalogItemId: "ffffffffffffffffffffffffffffffff",
              appName: "AnimStarterPack",
              sandboxName: "fab-listing-live",
              platform: "Windows",
            },
          ],
        }),
        { status: 200 },
      );
    },
    async (calls) => {
      const items = await getEpicLibraryItems("token");
      assert.equal(calls.urls.length, 2, "the cursor was followed");
      assert.equal(items.length, 5);

      const rows = normalizeEpicLibraryItems(items);
      assert.deepEqual(
        rows.map((row) => row.title),
        ["Subnautica", "Unreal Tournament"],
        "one row per product however many platform records, sandboxName as the name",
      );
      assert.equal(
        rows[1]?.appName,
        "UnrealTournamentDev",
        "Epic's real install app name, not a guessed hash",
      );
    },
  );
});
