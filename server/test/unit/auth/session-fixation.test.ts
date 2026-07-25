/**
 * T3: Session Fixation Test
 *
 * Session fixation occurs when the server reuses an existing session token
 * from a cookie instead of generating a new one after signin. An attacker
 * could pre-set a known `drop-token` cookie on the victim's browser, and
 * after the victim signs in, the attacker's known token would give them
 * access to the authenticated session.
 *
 * The vulnerability is in SessionHandler.signin():
 *   const token = this.getSessionToken(h3) ?? this.createSessionCookie(h3, expiresAt);
 *   //                              ^^ if pre-set cookie exists, it's reused
 *
 * Expected fix: always call createSessionCookie to issue a new token, and
 * invalidate the old session in the provider.
 */

import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { createMockH3Event } from "../../utils/h3";

// ---------------------------------------------------------------------------
// Module mocks – hoisted by vitest before all imports
// ---------------------------------------------------------------------------

// Mock cache to prevent cache handler from needing real storage
vi.mock("../../../../server/server/internal/cache", () => ({
  default: {
    createCache: () => ({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      remove: vi.fn(),
    }),
  },
}));

// Mock prisma module to prevent database dependency
const mockLinkedMFACount = vi.fn();
const mockSessionFindUnique = vi.fn();
const mockSessionUpsert = vi.fn();
const mockSessionDeleteMany = vi.fn().mockResolvedValue({ count: 1 });

vi.mock("../../../../server/server/internal/db/database", () => ({
  default: {
    linkedMFAMec: {
      count: (...args: unknown[]) => mockLinkedMFACount(...args),
    },
    session: {
      findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
      upsert: (...args: unknown[]) => mockSessionUpsert(...args),
      deleteMany: (...args: unknown[]) => mockSessionDeleteMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// SUT import
// ---------------------------------------------------------------------------

import { SessionHandler } from "../../../../server/server/internal/session/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock H3Event with a working headers.get() for Cookie. */
function createEventWithCookie(
  cookieValue?: string,
  overrides: Record<string, unknown> = {},
) {
  const event = createMockH3Event({
    method: "POST",
    ...overrides,
  }) as Record<string, unknown>;

  // Override headers with one that has .get() — needed by getSessionToken()
  const headersObj = {
    get: (name: string) => {
      if (name === "Cookie" && cookieValue) return cookieValue;
      return undefined;
    },
  };
  event.headers = headersObj;
  return event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Session Fixation (T3)", () => {
  let setCookieSpy: ReturnType<typeof vi.fn>;
  let originalSetCookie: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLinkedMFACount.mockResolvedValue(0);
    mockSessionFindUnique.mockResolvedValue(null);
    mockSessionUpsert.mockImplementation(
      ({
        where,
        create,
        update,
      }: {
        where: { token: string };
        create?: { data: object };
        update?: { data: object };
      }) => ({
        data: { token: where.token, data: create?.data || update?.data },
      }),
    );

    // Spy on global setCookie (auto-import in Nuxt, stubbed in test/setup.ts)
    originalSetCookie = (globalThis as Record<string, unknown>).setCookie;
    setCookieSpy = vi.fn();
    (globalThis as Record<string, unknown>).setCookie = setCookieSpy;
  });

  afterEach(() => {
    // Restore global setCookie
    (globalThis as Record<string, unknown>).setCookie = originalSetCookie;
  });

  it("no pre-set cookie → signin creates new session token", async () => {
    const handler = new SessionHandler();
    const event = createEventWithCookie(undefined);

    const result = await handler.signin(event as never, "user-1");

    // New token should have been generated and set as a response cookie
    // setCookie signature: setCookie(event, name, value, opts)
    expect(setCookieSpy).toHaveBeenCalledWith(
      expect.any(Object),
      "drop-token",
      expect.any(String),
      expect.objectContaining({ expires: expect.any(Date) }),
    );
    expect(result).toBe("signin");
  });

  it("pre-set drop-token cookie → new token issued and old session invalidated", async () => {
    const handler = new SessionHandler();
    const attackerToken = "attacker-known-token";
    const event = createEventWithCookie(`drop-token=${attackerToken}`);

    const result = await handler.signin(event as never, "victim-user");

    // Fixed: signin() always issues a new token, preventing session fixation.
    // The old (attacker-known) token is invalidated in the provider.
    expect(setCookieSpy).toHaveBeenCalledWith(
      expect.any(Object),
      "drop-token",
      expect.any(String),
      expect.objectContaining({ expires: expect.any(Date) }),
    );
    // The new token must differ from the attacker's known token
    const newToken = setCookieSpy.mock.calls[0][2] as string;
    expect(newToken).not.toBe(attackerToken);
    // Old session was removed from the provider
    expect(mockSessionDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ token: attackerToken }),
      }),
    );
    expect(result).toBe("signin");
  });
});
