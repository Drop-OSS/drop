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

  const ageFilter = await getAgeRestrictionFilter(user.id, user.admin);
  const collection = await userLibraryManager.fetchLibrary(user.id, ageFilter);

  return collection;
});
