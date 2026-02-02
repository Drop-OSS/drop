import prisma from "~/server/internal/db/database";

export default defineEventHandler(async () => {
  const depots = await prisma.depot.findMany({ select: { endpoint: true } });

  return depots;
});
