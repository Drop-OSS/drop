import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const user = await h3.context.session.getAdminUser(h3);
  if (!user) throw createError({ statusCode: 403 });

  const query = await getQuery(h3);
  const gameId = query.id?.toString();
  if (!gameId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing id in request params",
    });

  const unimportedVersions = await libraryManager.fetchUnimportedVersions(
    gameId
  );
  if (!unimportedVersions)
    throw createError({ statusCode: 400, statusMessage: "Invalid game ID" });

  return unimportedVersions;
});
