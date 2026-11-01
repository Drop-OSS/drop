import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createUbisoftSession,
  completeUbisoftTwoFactor,
  loginUbisoftWithRememberTicket,
  refreshUbisoftSession,
  getUbisoftOwnedTitles,
} from "./client";

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

// Hermetic tests: no network access. Global fetch is stubbed per test.
const originalFetch = globalThis.fetch;
let fetchCalls: { url: string; init: RequestInit }[] = [];

function stubFetch(
  responses: {
    match: (url: string) => boolean;
    status: number;
    body: unknown;
  }[],
) {
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    fetchCalls.push({ url, init: init ?? {} });
    const responder = responses.find((r) => r.match(url));
    if (!responder) {
      return new Response("{}", { status: 404 });
    }
    return new Response(JSON.stringify(responder.body), {
      status: responder.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

const SESSION_URL = "https://public-ubiservices.ubi.com/v3/profiles/sessions";
const OWNED_URL =
  "https://public-ubiservices.ubi.com/v1/profiles/user-1/ownedtitles";

/** Responds to successive calls in order, with optional response headers. */
function stubFetchQueue(
  responses: {
    status?: number;
    body?: unknown;
    headers?: Record<string, string>;
  }[],
) {
  let index = 0;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    fetchCalls.push({ url: String(input), init: init ?? {} });
    const responder = responses[Math.min(index++, responses.length - 1)];
    return new Response(JSON.stringify(responder.body ?? {}), {
      status: responder.status ?? 200,
      headers: {
        "Content-Type": "application/json",
        ...responder.headers,
      },
    });
  }) as typeof fetch;
}

const UBI_SESSION = {
  ticket: "ubi-ticket",
  sessionId: "session-1",
  userId: "user-1",
  rememberMeTicket: "remember-1",
  expiration: "2030-01-01T00:00:00Z",
  profiles: [{ nameOnPlatform: "User" }],
};

beforeEach(() => {
  fetchCalls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("createUbisoftSession exchanges credentials for a session ticket", async () => {
  stubFetch([
    {
      match: (url) => url === SESSION_URL,
      status: 200,
      body: {
        ticket: "ubi-ticket",
        sessionId: "session-1",
        userId: "user-1",
        username: "user",
        nameOnPlatform: "User",
        expiration: "2026-01-01T00:00:00Z",
      },
    },
  ]);

  const session = await createUbisoftSession("user@example.com", "hunter2");

  if (!("ticket" in session)) throw new Error("expected a direct session");
  assert.equal(session.ticket, "ubi-ticket");
  assert.equal(session.userId, "user-1");
  assert.equal(session.sessionId, "session-1");
  assert.equal(session.rememberMeTicket, undefined);

  const call = fetchCalls[0];
  assert.equal(call.init.method, "POST");
  const headers = call.init.headers as Record<string, string>;
  // The login flow runs under Ubisoft's web club app id, the one open
  // source clients authenticate with, not the uplay API app id.
  assert.equal(headers["Ubi-AppId"], "82b650c0-6cb3-40c0-9f41-25a53b62b206");
  // Credentials must travel as Basic auth, never as query params or body text.
  assert.ok(headers["Authorization"]?.startsWith("Basic "));
  assert.ok(!call.url.includes("hunter2"));
});

test("createUbisoftSession echoes the Ubi-Challenge nonce and retries once", async () => {
  stubFetchQueue([
    { status: 401, headers: { "Ubi-Challenge": "nonce-42" } },
    { status: 200, body: UBI_SESSION },
  ]);

  const session = await createUbisoftSession("user@example.com", "hunter2");

  assert.equal(fetchCalls.length, 2);
  const retryHeaders = fetchCalls[1]?.init.headers as Record<string, string>;
  assert.equal(retryHeaders["Ubi-Challenge"], "nonce-42");
  assert.equal(
    "ticket" in session && session.ticket,
    "ubi-ticket",
    "the retry must carry the session through",
  );
});

test("createUbisoftSession surfaces the 2FA challenge instead of a session", async () => {
  stubFetchQueue([
    {
      status: 200,
      body: {
        twoFactorAuthenticationTicket: "2fa-ticket",
        twoFactorAuthenticationMethod: "email",
      },
    },
  ]);

  const result = await createUbisoftSession("user@example.com", "hunter2");

  assert.equal(fetchCalls.length, 1, "a 2FA challenge must not be retried");
  assert.ok("twoFactorRequired" in result);
  assert.equal(result.twoFactorTicket, "2fa-ticket");
  assert.equal(result.method, "email");
});

test("createUbisoftSession reports rejected credentials as 401", async () => {
  stubFetchQueue([{ status: 401, body: { message: "bad" } }]);

  await assert.rejects(
    createUbisoftSession("user@example.com", "wrong"),
    typedError(401, /rejected/i),
  );
});

test("completeUbisoftTwoFactor posts the code with the 2FA ticket", async () => {
  stubFetchQueue([{ status: 200, body: UBI_SESSION }]);

  const session = await completeUbisoftTwoFactor("654321", "2fa-ticket");

  assert.equal(session.ticket, "ubi-ticket");
  const headers = fetchCalls[0]?.init.headers as Record<string, string>;
  assert.equal(headers["Authorization"], "ubi_2fa_v1 t=2fa-ticket");
  assert.equal(headers["Ubi-2FACode"], "654321");
});

test("loginUbisoftWithRememberTicket reopens a session without a password", async () => {
  stubFetchQueue([{ status: 200, body: { ...UBI_SESSION, ticket: "fresh" } }]);

  const session = await loginUbisoftWithRememberTicket("remember-1");

  assert.equal(session.ticket, "fresh");
  const headers = fetchCalls[0]?.init.headers as Record<string, string>;
  assert.equal(headers["Authorization"], "rm_v1 t=remember-1");
  assert.ok(
    !JSON.stringify(fetchCalls[0]?.init).includes("hunter2"),
    "no password may appear in the remember-me login",
  );
});

test("refreshUbisoftSession replays the previous ticket", async () => {
  stubFetch([
    {
      match: (url) => url === SESSION_URL,
      status: 200,
      body: {
        ticket: "ubi-ticket-2",
        sessionId: "session-2",
        userId: "user-1",
        username: "user",
        nameOnPlatform: "User",
        expiration: "2026-01-02T00:00:00Z",
      },
    },
  ]);

  const session = await refreshUbisoftSession("ubi-ticket-1");

  assert.equal(session.ticket, "ubi-ticket-2");
  const headers = fetchCalls[0].init.headers as Record<string, string>;
  assert.equal(headers["Authorization"], "Ubi_v1 t=ubi-ticket-1");
});

test("getUbisoftOwnedTitles returns owned spaces for the account", async () => {
  stubFetch([
    {
      match: (url) => url === OWNED_URL,
      status: 200,
      body: [{ spaceId: "space-1" }, { spaceId: "space-2" }],
    },
  ]);

  const titles = await getUbisoftOwnedTitles("ubi-ticket", "user-1");

  assert.deepEqual(titles, [{ spaceId: "space-1" }, { spaceId: "space-2" }]);
  const headers = fetchCalls[0].init.headers as Record<string, string>;
  assert.equal(headers["Authorization"], "Ubi_v1 t=ubi-ticket");
});

test("owned titles failure surfaces a typed error, not raw response data", async () => {
  stubFetch([
    {
      match: (url) => url === OWNED_URL,
      status: 401,
      body: { error: "unauthorized" },
    },
  ]);

  await assert.rejects(
    () => getUbisoftOwnedTitles("expired-ticket", "user-1"),
    typedError(401),
  );
});
