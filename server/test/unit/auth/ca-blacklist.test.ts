import { describe, expect, it, vi, beforeEach } from "vitest";
import { dbCertificateStore } from "../../../../server/server/internal/clients/ca-store";

// ---------------------------------------------------------------------------
// Mock systemConfig so its singleton doesn't call useRuntimeConfig() at import
// time (which requires a Nuxt app instance).
// ---------------------------------------------------------------------------
vi.mock("../../../../server/server/internal/config/sys-conf", () => ({
  systemConfig: {
    getDataFolder: () => "/tmp/test-certs",
  },
}));

// ---------------------------------------------------------------------------
// Mock prisma so we control what findUnique returns without a real DB.
// ---------------------------------------------------------------------------
const mockFindUnique = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock("../../../../server/server/internal/db/database", () => ({
  default: {
    certificate: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// dbCertificateStore.checkBlacklistCertificate
// ---------------------------------------------------------------------------
//
// BUG (ca-store.ts:93): when findUnique returns null (cert not in DB),
// the current implementation returns `true` — meaning any missing/deleted
// certificate is treated as blacklisted. The correct behaviour is to
// return `false`: a missing certificate has never been blacklisted.
//
// Expected contract:
//   - findUnique(null)  → false  (not in DB ≠ blacklisted)
//   - findUnique({ blacklisted: true })  → true   (explicitly blacklisted)
//   - findUnique({ blacklisted: false }) → false  (explicitly not blacklisted)
// ---------------------------------------------------------------------------

describe("dbCertificateStore.checkBlacklistCertificate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for cert not in database (missing ≠ blacklisted)", async () => {
    // Arrange: no row exists
    mockFindUnique.mockResolvedValue(null);

    // Act
    const result =
      await dbCertificateStore().checkBlacklistCertificate("non-existent");

    // Assert: missing is NOT blacklisted
    expect(result).toBe(false);
    // ^ Currently fails: bug at ca-store.ts:93 returns `true`
    //   Fix: change `return true` to `return false`
  });

  it("returns true for explicitly blacklisted cert", async () => {
    // Arrange: row exists with blacklisted=true
    mockFindUnique.mockResolvedValue({ blacklisted: true });

    // Act
    const result =
      await dbCertificateStore().checkBlacklistCertificate("evil-cert");

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for cert that exists but is not blacklisted", async () => {
    // Arrange: row exists with blacklisted=false
    mockFindUnique.mockResolvedValue({ blacklisted: false });

    // Act
    const result =
      await dbCertificateStore().checkBlacklistCertificate("clean-cert");

    // Assert
    expect(result).toBe(false);
  });
});
