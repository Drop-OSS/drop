import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";

/**
 * Fetch all collections
 */
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["collections:read"]);
  if (!userId)
    throw createError({
      statusCode: 403,
    });

  const collections = await userLibraryManager.fetchCollections(userId);
  return collections;
});
