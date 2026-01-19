import prisma from "~/server/internal/db/database";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";

export default defineClientEventHandler(async () => {
  const depots = await prisma.depot.findMany({ select: { endpoint: true } });

  return depots;
});
