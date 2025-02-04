import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["collections:read"]);
  if (!userId)
    throw createError({
      statusCode: 403,
    });

  const body = await readBody(h3);

  const name = body.name;
  if (!name)
    throw createError({ statusCode: 400, statusMessage: "Requires name" });

  // Create the collection using the manager
  const newCollection = await userLibraryManager.collectionCreate(name, userId);
  return newCollection;
});
