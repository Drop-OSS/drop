import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";
import userLibraryManager from "~/server/internal/userlibrary";
import { getAgeRestrictionFilter } from "~/server/internal/utils/ageRestrictions";

export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();

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

  // Add the game to the default collection
  await userLibraryManager.libraryAdd(gameId, user.id);
  return {};
});
