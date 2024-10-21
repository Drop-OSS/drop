import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const user = await h3.context.session.getAdminUser(h3);
  if (!user) throw createError({ statusCode: 403 });

  const query = getQuery(h3);
  const gameId = query.id?.toString();
  if (!gameId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing id in query",
    });

  const game = await prisma.game.findUnique({
    where: {
      id: gameId,
    },
    include: {
      versions: {
        orderBy: {
          versionIndex: "asc",
        },
        select: {
          versionIndex: true,
          versionName: true,
          platform: true,
          delta: true,
        },
      },
    },
  });

  if (!game)
    throw createError({ statusCode: 404, statusMessage: "Game ID not found" });

  const unimportedVersions = await libraryManager.fetchUnimportedVersions(
    game.id,
  );

  return { game, unimportedVersions };
});
