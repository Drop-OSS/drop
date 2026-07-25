/**
 * T2: OIDC group-to-admin escalation test.
 *
 * Verifies fetchOrCreateUser() correctly assigns admin role based on
 * OIDC group membership, preventing privilege escalation when an OIDC
 * provider is compromised or misconfigured.
 *
 * Strategy:
 * 1. Mock prisma so no real DB is needed (create + findFirst).
 * 2. Mock jose to avoid real JWKS fetching (not used by fetchOrCreateUser).
 * 3. Mock objectHandler + jdenticon to avoid profile-picture side effects.
 * 4. Construct OIDCManager directly (bypass private constructor via cast).
 * 5. Call fetchOrCreateUser() with three userinfo shapes and verify admin flag.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks – hoisted by vitest before all imports
// ---------------------------------------------------------------------------

const mockLinkedAuthMecFindFirst = vi.fn();
const mockLinkedAuthMecCreate = vi.fn();

vi.mock("../../../../server/server/internal/db/database", () => ({
  default: {
    linkedAuthMec: {
      findFirst: (...args: unknown[]) => mockLinkedAuthMecFindFirst(...args),
      create: (...args: unknown[]) => mockLinkedAuthMecCreate(...args),
    },
  },
}));

vi.mock("jose", () => ({
  createRemoteJWKSet: () => vi.fn(),
}));

vi.mock("../../../../server/server/internal/objects", () => ({
  default: {
    createFromSource: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock systemConfig so its singleton doesn't call useRuntimeConfig() at import
vi.mock("../../../../server/server/internal/config/sys-conf", () => ({
  systemConfig: {
    shouldOidcRequireHttps: () => false,
    getExternalUrl: () => "http://localhost:3000",
  },
}));

// Mock sessionHandler to prevent deep dependency chain (session → db → cache → useStorage)
vi.mock("../../../../server/server/internal/session", () => ({
  default: {
    searchSessions: vi.fn().mockResolvedValue([]),
    signoutByToken: vi.fn().mockResolvedValue(undefined),
  },
  sessionHandler: {
    searchSessions: vi.fn().mockResolvedValue([]),
    signoutByToken: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("jdenticon", () => ({
  toPng: () => Buffer.from(""),
}));

// Mock generated Prisma enums – not available unless prisma generate is run
vi.mock("../../../../prisma/client/enums", () => ({
  AuthMec: { OpenID: "OpenID", Simple: "Simple" },
}));

// Mock logging module – resolves via relative path for vitest module resolution
vi.mock("../../../../server/server/internal/logging", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// SUT import
// ---------------------------------------------------------------------------

import { OIDCManager } from "../../../../server/server/internal/auth/oidc/index";

// OIDCUserInfo is not exported from the source module – define local type
interface OIDCUserInfo {
  sub: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  email?: string;
  groups?: Array<string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Construct an OIDCManager with specific admin/user groups for one test. */
function createManager(adminGroup?: string, userGroup?: string): OIDCManager {
  const prevAdmin = process.env.OIDC_ADMIN_GROUP;
  const prevUser = process.env.OIDC_USER_GROUP;

  // Set env to desired values (delete if undefined)
  if (adminGroup !== undefined) {
    process.env.OIDC_ADMIN_GROUP = adminGroup;
  } else {
    delete process.env.OIDC_ADMIN_GROUP;
  }
  if (userGroup !== undefined) {
    process.env.OIDC_USER_GROUP = userGroup;
  } else {
    delete process.env.OIDC_USER_GROUP;
  }

  const manager = new (OIDCManager as unknown as new (
    oidcConfiguration: {
      issuer: string;
      authorization_endpoint: string;
      token_endpoint: string;
      userinfo_endpoint: string;
      jwks_uri: string;
      scopes_supported: string[];
    },
    clientId: string,
    clientSecret: string,
    externalUrl: URL,
  ) => OIDCManager)(
    {
      issuer: "https://mock-oidc.test",
      authorization_endpoint: "https://mock-oidc.test/auth",
      token_endpoint: "https://mock-oidc.test/token",
      userinfo_endpoint: "https://mock-oidc.test/userinfo",
      jwks_uri: "https://mock-oidc.test/jwks",
      scopes_supported: ["openid", "profile", "email"],
    },
    "mock-client-id",
    "mock-client-secret",
    new URL("http://localhost:3000"),
  );

  // Restore previous env values
  if (prevAdmin !== undefined) {
    process.env.OIDC_ADMIN_GROUP = prevAdmin;
  } else {
    delete process.env.OIDC_ADMIN_GROUP;
  }
  if (prevUser !== undefined) {
    process.env.OIDC_USER_GROUP = prevUser;
  } else {
    delete process.env.OIDC_USER_GROUP;
  }

  return manager;
}

function makeCreatedUser(overrides: {
  id: string;
  username: string;
  admin: boolean;
  email: string;
  displayName: string;
  profilePictureObjectId?: string;
}) {
  return {
    user: {
      id: overrides.id,
      username: overrides.username,
      admin: overrides.admin,
      email: overrides.email,
      displayName: overrides.displayName,
      profilePictureObjectId: overrides.profilePictureObjectId ?? "pic-default",
      enabled: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchOrCreateUser – OIDC group-to-admin escalation (T2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // No existing user by default
    mockLinkedAuthMecFindFirst.mockResolvedValue(null);
  });

  it("creates admin user when OIDC provider returns adminGroup", async () => {
    const manager = createManager("drop-admins", "drop-users");

    const userinfo: OIDCUserInfo = {
      sub: "admin-user-1",
      preferred_username: "adminuser",
      email: "admin@test.com",
      name: "Admin User",
      groups: ["drop-admins"],
    };

    mockLinkedAuthMecCreate.mockResolvedValueOnce(
      makeCreatedUser({
        id: "uid-admin",
        username: "adminuser",
        admin: true,
        email: "admin@test.com",
        displayName: "Admin User",
      }),
    );

    const result = await (manager as unknown as { fetchOrCreateUser: (info: OIDCUserInfo) => Promise<{ admin: boolean }> }).fetchOrCreateUser(userinfo);

    expect(result.admin).toBe(true);
    // Verify prisma.create was called with admin:true in connectOrCreate.create
    expect(mockLinkedAuthMecCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user: expect.objectContaining({
            connectOrCreate: expect.objectContaining({
              create: expect.objectContaining({
                admin: true,
              }),
            }),
          }),
        }),
      }),
    );
  });

  it("creates non-admin user when OIDC provider returns normal group only", async () => {
    const manager = createManager("drop-admins", "drop-users");

    const userinfo: OIDCUserInfo = {
      sub: "regular-user-1",
      preferred_username: "regularuser",
      email: "user@test.com",
      name: "Regular User",
      groups: ["drop-users"],
    };

    mockLinkedAuthMecCreate.mockResolvedValueOnce(
      makeCreatedUser({
        id: "uid-regular",
        username: "regularuser",
        admin: false,
        email: "user@test.com",
        displayName: "Regular User",
      }),
    );

    const result = await (manager as unknown as { fetchOrCreateUser: (info: OIDCUserInfo) => Promise<{ admin: boolean }> }).fetchOrCreateUser(userinfo);

    expect(result.admin).toBe(false);
    expect(mockLinkedAuthMecCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user: expect.objectContaining({
            connectOrCreate: expect.objectContaining({
              create: expect.objectContaining({
                admin: false,
              }),
            }),
          }),
        }),
      }),
    );
  });

  it("creates non-admin user when OIDC provider returns no groups and no OIDC_USER_GROUP is set", async () => {
    // When OIDC_USER_GROUP is not set, isUser defaults to true for everyone
    const manager = createManager("drop-admins", undefined);

    const userinfo: OIDCUserInfo = {
      sub: "no-group-user-1",
      preferred_username: "nouser",
      email: "no@test.com",
      name: "No Group User",
    };

    mockLinkedAuthMecCreate.mockResolvedValueOnce(
      makeCreatedUser({
        id: "uid-nogroup",
        username: "nouser",
        admin: false,
        email: "no@test.com",
        displayName: "No Group User",
      }),
    );

    const result = await (manager as unknown as { fetchOrCreateUser: (info: OIDCUserInfo) => Promise<{ admin: boolean }> }).fetchOrCreateUser(userinfo);

    expect(result.admin).toBe(false);
    expect(mockLinkedAuthMecCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user: expect.objectContaining({
            connectOrCreate: expect.objectContaining({
              create: expect.objectContaining({
                admin: false,
              }),
            }),
          }),
        }),
      }),
    );
  });
});
