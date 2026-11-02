import aclManager from "~/server/internal/acls";
import profileManager from "~/server/internal/profiles";
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
  // The web view has no profile switcher yet, so it shows the account's
  // default player's stats.
  const profile = await profileManager.defaultProfile(user.id);
  const collection = await userLibraryManager.fetchLibrary(
    user.id,
    profile.id,
    ageFilter,
  );

  return collection;
});
