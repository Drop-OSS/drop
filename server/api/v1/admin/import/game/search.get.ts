import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const user = await h3.context.session.getAdminUser(h3);
  if (!user) throw createError({ statusCode: 403 });

  const query = getQuery(h3);
  const search = query.q?.toString();
  if (!search)
    throw createError({ statusCode: 400, statusMessage: "Invalid search" });

  return await h3.context.metadataHandler.search(search);
});
