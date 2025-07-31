import aclManager from "~/server/internal/acls";
import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:game:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const unimportedGames = await libraryManager.fetchUnimportedGames();
  const libraries = Object.fromEntries(
    (await libraryManager.fetchLibraries()).map((e) => [e.id, e]),
  );
  const iterableUnimportedGames = Object.entries(unimportedGames)
    .map(([libraryId, gameArray]) =>
      gameArray.map((e) => ({ game: e, library: libraries[libraryId] })),
    )
    .flat();
  return { unimportedGames: iterableUnimportedGames };
});
