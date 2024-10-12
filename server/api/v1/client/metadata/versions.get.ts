import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(async (h3, {}) => {
  const query = getQuery(h3);
  const id = query.id?.toString();
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "No ID in request query",
    });

  const versions = await prisma.gameVersion.findMany({
    where: {
      gameId: id,
    },
  });

  return versions;
});
