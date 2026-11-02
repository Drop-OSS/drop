import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { getProfile } from "~/server/internal/profiles/http";
import userLibraryManager from "~/server/internal/userlibrary";
import { getAgeRestrictionFilter } from "~/server/internal/utils/ageRestrictions";

export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();
  const profile = await getProfile(h3, user.id);
  const ageFilter = await getAgeRestrictionFilter(user.id, user.admin);
  const library = await userLibraryManager.fetchLibrary(
    user.id,
    profile.id,
    ageFilter,
  );
  return library.entries.map((e) => e.game);
});
