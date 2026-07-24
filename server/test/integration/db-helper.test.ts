/**
 * Integration test for the `withTestTransaction` helper.
 *
 * Verifies the transaction-isolation contract: rows inserted inside the
 * transaction must not be visible after the test body completes (rollback).
 *
 * Tests skip gracefully (return) when `DATABASE_URL` is not set, so CI
 * without a test DB continues to pass. Local dev with a test DB gets the
 * real assertions.
 */
import { describe, it, expect } from "vitest";
import { withTestTransaction } from "../utils/db";

const HAS_TEST_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_TEST_DB)("withTestTransaction", () => {
  it("rolls back inserts after the callback resolves", async () => {
    const marker = `rollback-test-${Date.now()}`;

    await withTestTransaction(async (tx) => {
      // ApplicationSettings has only `timestamp` as required field — all
      // other fields have defaults. Perfect for a throwaway row.
      await tx.applicationSettings.create({
        data: {
          serverName: marker,
        },
      });

      // Inside the transaction, the row should be visible.
      const found = await tx.applicationSettings.findFirst({
        where: { serverName: marker },
      });
      expect(found).not.toBeNull();
    });

    // After rollback, the row must NOT exist.
    // Use a fresh client (no enclosing transaction) to verify isolation.
    const { PrismaClient } = await import("../../prisma/client/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL ?? "",
    });
    const prisma = new PrismaClient({ adapter });
    try {
      const all = await prisma.applicationSettings.findMany({
        where: { serverName: { contains: "rollback-test-" } },
      });
      expect(all).toHaveLength(0);
    } finally {
      await prisma.$disconnect();
    }
  });
});
