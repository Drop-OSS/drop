import aclManager from "~/server/internal/acls";
import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["library:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const unimportedGames = await libraryManager.fetchUnimportedGames();
  const libraries = await libraryManager.fetchLibraries();

  return { unimportedGames, hasLibraries: libraries.length > 0 };
});
