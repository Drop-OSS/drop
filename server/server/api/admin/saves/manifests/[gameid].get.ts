import { createError, defineEventHandler, getRouterParam } from "h3";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

/** The full stored entry for one game (the sync client's fetch shape). */
export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["settings:update"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });

  const gameId = getRouterParam(event, "gameid");
  if (!gameId)
    throw createError({ statusCode: 400, statusMessage: "No gameId" });

  const manifest = await prisma.saveManifest.findUnique({
    where: { gameId },
    include: { game: { select: { mName: true, metadataId: true } } },
  });
  if (!manifest)
    throw createError({
      statusCode: 404,
      statusMessage: "No save manifest for this game",
    });

  return manifest;
});
