import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";
import { getAgeRestrictionFilter } from "~/server/internal/utils/ageRestrictions";

export default defineEventHandler(async (h3) => {
  const user = await aclManager.getUserACL(h3, ["collections:read"]);
  if (!user)
    throw createError({
      statusCode: 403,
      statusMessage: "Requires authentication",
    });

  const id = getRouterParam(h3, "id");
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "ID required in route params",
    });

  const ageFilter = await getAgeRestrictionFilter(user.id, user.admin);

  // Fetch specific collection
  // Will not return the default collection
  const collection = await userLibraryManager.fetchCollection(id, ageFilter);
  if (!collection)
    throw createError({
      statusCode: 404,
      statusMessage: "Collection not found",
    });

  // Verify user owns this collection
  if (collection.userId !== user.id)
    throw createError({
      statusCode: 403,
      statusMessage: "Not authorized to access this collection",
    });

  return collection;
});
