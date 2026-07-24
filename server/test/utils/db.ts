import { afterEach } from "vitest";
import type { PrismaClient } from "../../prisma/client/client";

/**
 * Transaction-per-test DB helper.
 *
 * Pattern: open a Prisma transaction, run test body, rollback on completion.
 * Requires a real test DB. Set DATABASE_URL in .env.test or vitest config.
 *
 * Prisma v7 requires a driver adapter. Import the appropriate adapter
 * (e.g. @prisma/adapter-pg) at the call site and pass it in:
 *
 *   import { PrismaPg } from "@prisma/adapter-pg";
 *   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
 *   await withTestTransaction(async (tx) => { ... }, adapter);
 */
export async function withTestTransaction<T>(
  body: (
    tx: Omit<
      PrismaClient,
      "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
    >,
  ) => Promise<T>,
  adapter?: unknown,
): Promise<T> {
  // Lazy import — avoids loading Prisma when tests don't touch DB
  const { PrismaClient } = await import("../../prisma/client/client");
  // Cast to any — adapter shape is provider-specific; pass-through only
  const options = adapter ? { adapter } : {};
  const prisma = new (
    PrismaClient as unknown as new (o?: unknown) => PrismaClient
  )(options);
  try {
    return await prisma.$transaction(async (tx) => body(tx));
  } finally {
    await prisma.$disconnect();
  }
}

export function teardownPrisma(prisma: PrismaClient) {
  afterEach(async () => {
    await prisma.$disconnect();
  });
}
