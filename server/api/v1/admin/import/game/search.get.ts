import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const user = await h3.context.session.getAdminUser(h3);
  if (!user) throw createError({ statusCode: 403 });

  const query = getQuery(h3);
  const search = query.q?.toString();
  if (!search)
    throw createError({ statusCode: 400, statusMessage: "Invalid search" });

  const results = await h3.context.metadataHandler.search(search);

  if (results.length == 0)
    throw createError({
      statusCode: 500,
      statusMessage: "No metadata provider returned search results.",
    });

  return results;
});
