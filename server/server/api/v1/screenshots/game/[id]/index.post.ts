// create new screenshot
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import screenshotManager from "~/server/internal/screenshots";

// Only clients upload screenshots - consider using defineClientEventHandler
// PENDING(sonar): refactor to use defineClientEventHandler for client-only routes - deferred
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["screenshots:new"]);
  if (!userId) throw createError({ statusCode: 403 });

  const gameId = getRouterParam(h3, "id");
  if (!gameId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing game ID",
    });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true },
  });
  if (!game)
    throw createError({ statusCode: 400, statusMessage: "Invalid game ID" });

  await screenshotManager.upload(userId, gameId, h3.node.req);
});
