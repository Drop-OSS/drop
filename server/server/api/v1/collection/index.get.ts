import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";
import { getAgeRestrictionFilter } from "~/server/internal/utils/ageRestrictions";

export default defineEventHandler(async (h3) => {
  const user = await aclManager.getUserACL(h3, ["collections:read"]);
  if (!user)
    throw createError({
      statusCode: 403,
    });

  const ageFilter = await getAgeRestrictionFilter(user.id, user.admin);
  const collections = await userLibraryManager.fetchCollections(
    user.id,
    ageFilter,
  );
  return collections;
});
