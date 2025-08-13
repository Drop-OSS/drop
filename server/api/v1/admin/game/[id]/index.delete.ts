import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

/**
 * Delete a game from this instance
 * @param id Game ID
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:delete"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const gameId = getRouterParam(h3, "id")!;

  await prisma.game.delete({
    where: {
      id: gameId,
    },
  });

  return {};
});
