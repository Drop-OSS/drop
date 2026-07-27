import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";
import { getAgeRestrictionFilter } from "~/server/internal/utils/ageRestrictions";

export default defineClientEventHandler(async (_h3, { fetchUser }) => {
  const user = await fetchUser();
  const ageFilter = await getAgeRestrictionFilter(user.id, user.admin);
  const library = await userLibraryManager.fetchLibrary(user.id, ageFilter);
  return library.entries.map((e) => e.game);
});
