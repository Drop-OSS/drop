// T4: ACL confused deputy test
//
// allowSystemACL() must reject non-admin sessions even when a valid system
// token is present. This prevents privilege escalation via stolen token when
// attacker already has a low-privilege session.
//
// See: server/server/internal/acls/index.ts

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MinimumRequestObject } from "../../../../server/server/h3";

// Mock the enums that ACL module imports via ~ alias
const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock("~/prisma/client/enums", () => ({
  APITokenMode: { System: "System", User: "User", Client: "Client" },
}));

vi.mock("../../../../server/server/internal/session", () => ({
  default: {
    getSession: mockGetSession,
  },
}));

vi.mock("../../../../server/server/internal/db/database", () => ({
  default: {
    user: { findUnique: vi.fn() },
    aPIToken: { findUnique: vi.fn() },
  },
}));

import { aclManager } from "../../../../server/server/internal/acls/index";
import dbModule from "../../../../server/server/internal/db/database";

function makeRequest(headers?: Record<string, string>): MinimumRequestObject {
  return { headers: new Headers(headers ?? {}) };
}

const adminUser = { id: "admin-1", admin: true };
const nonAdminUser = { id: "user-1", admin: false };
const systemACLs = ["setup"] as any;

const authenticatedSession = (userId: string) => ({
  authenticated: {
    userId,
    level: 10,
    requiredLevel: 10,
    superleveledExpiry: undefined,
  },
});

describe("allowSystemACL — confused deputy prevention (T4)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prismaUserFindUnique: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prismaTokenFindUnique: any;

  beforeEach(() => {
    vi.clearAllMocks();

    prismaUserFindUnique = dbModule.user.findUnique;
    prismaTokenFindUnique = dbModule.aPIToken.findUnique;
  });

  it("non-admin session + valid system token — DENIED (session takes precedence)", async () => {
    mockGetSession.mockResolvedValue(authenticatedSession(nonAdminUser.id));
    prismaUserFindUnique.mockResolvedValue(nonAdminUser);
    prismaTokenFindUnique.mockResolvedValue({
      token: "stolen-system-token",
      mode: "System",
      acls: ["setup"],
    });

    const request = makeRequest({
      Authorization: "Bearer stolen-system-token",
      Cookie: "drop-token=valid-session",
    });

    const result = await aclManager.allowSystemACL(request, systemACLs);

    expect(result).toBe(false);
    expect(prismaTokenFindUnique).not.toHaveBeenCalled();
  });

  it("admin session — GRANTED", async () => {
    mockGetSession.mockResolvedValue(authenticatedSession(adminUser.id));
    prismaUserFindUnique.mockResolvedValue(adminUser);

    const result = await aclManager.allowSystemACL(makeRequest(), systemACLs);

    expect(result).toBe(true);
  });

  it("no session, valid system token — GRANTED (normal token auth)", async () => {
    mockGetSession.mockResolvedValue(undefined);
    prismaTokenFindUnique.mockResolvedValue({
      token: "valid-system-token",
      mode: "System",
      acls: ["setup"],
    });

    const request = makeRequest({
      Authorization: "Bearer valid-system-token",
    });

    const result = await aclManager.allowSystemACL(request, systemACLs);

    expect(result).toBe(true);
  });

  it("no session, no token — DENIED", async () => {
    mockGetSession.mockResolvedValue(undefined);
    prismaTokenFindUnique.mockResolvedValue(null);

    const result = await aclManager.allowSystemACL(makeRequest(), systemACLs);

    expect(result).toBe(false);
  });
});
