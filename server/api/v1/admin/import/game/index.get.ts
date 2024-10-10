import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const user = await h3.context.session.getAdminUser(h3);
  if (!user) throw createError({ statusCode: 403 });

  const unimportedGames = await libraryManager.fetchAllUnimportedGames();
  return { unimportedGames };
});
