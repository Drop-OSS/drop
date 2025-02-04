import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["collections:read"]);
  if (!userId)
    throw createError({
      statusCode: 403,
      statusMessage: "Requires authentication",
    });

  const collection = await userLibraryManager.fetchLibrary(userId);

  return collection;
});
