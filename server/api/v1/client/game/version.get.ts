import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(async (h3) => {
  const query = getQuery(h3);
  const id = query.id?.toString();
  const version = query.version?.toString();
  if (!id || !version)
    throw createError({
      statusCode: 400,
      message: "Missing id or version in query",
    });

  const gameVersion = await prisma.gameVersion.findUnique({
    where: {
      versionId: id,
    },
  });

  if (!gameVersion)
    throw createError({
      statusCode: 404,
      message: "Game version not found",
    });

  return gameVersion;
});
