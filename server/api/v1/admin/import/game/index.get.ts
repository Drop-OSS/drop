import aclManager from "~/server/internal/acls";
import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:game:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const unimportedGames = await libraryManager.fetchAllUnimportedGames();
  const iterableUnimportedGames = Object.entries(unimportedGames)
    .map(([libraryId, gameArray]) =>
      gameArray.map((e) => ({ game: e, library: libraryId })),
    )
    .flat();
  return { unimportedGames: iterableUnimportedGames };
});
