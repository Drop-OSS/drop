import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { getProfile } from "~/server/internal/profiles/http";
import userLibraryManager from "~/server/internal/userlibrary";

export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();
  const profile = await getProfile(h3, user.id);

  const collection = await userLibraryManager.fetchLibrary(
    user.id,
    profile.id,
  );

  return collection;
});
