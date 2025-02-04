import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "game:delete",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const query = getQuery(h3);
  const gameId = query.id?.toString();
  if (!gameId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing id in query",
    });

  await prisma.game.delete({
    where: {
      id: gameId,
    },
  });

  return {};
});
