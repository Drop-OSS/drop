import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(async (h3) => {
  const query = getQuery(h3);
  const id = query.id?.toString();
  if (!id)
    throw createError({
      statusCode: 400,
      message: "No ID in request query",
    });

  const versions = await prisma.gameVersion.findMany({
    where: {
      version: {
        gameId: id,
      },
      hidden: false,
    },
    orderBy: {
      versionIndex: "desc", // Latest one first
    },
  });

  return versions;
});
