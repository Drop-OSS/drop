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
