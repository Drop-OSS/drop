import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import userLibraryManager from "~/server/internal/userlibrary";
import { getAgeRestrictionFilter } from "~/server/internal/utils/ageRestrictions";

export default defineEventHandler(async (h3) => {
  const user = await aclManager.getUserACL(h3, ["collections:add"]);
  if (!user)
    throw createError({
      statusCode: 403,
    });

  const id = getRouterParam(h3, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "ID required in route params",
    });

  const body = await readBody(h3);
  const gameId = body.id;
  if (!gameId)
    throw createError({ statusCode: 400, statusMessage: "Game ID required" });

  const ageFilter = await getAgeRestrictionFilter(user.id, user.admin);
  if (ageFilter) {
    const allowed = await prisma.game.count({
      where: { id: gameId, ...ageFilter },
    });
    if (allowed === 0)
      throw createError({ statusCode: 404, statusMessage: "Game not found" });
  }

  const result = await userLibraryManager.collectionAdd(gameId, id, user.id);

  return result;
});
