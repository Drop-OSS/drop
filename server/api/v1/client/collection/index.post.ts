import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();

  const body = await readBody(h3);

  const name = body.name;
  if (!name)
    throw createError({ statusCode: 400, statusMessage: "Requires name" });

  // Create the collection using the manager
  const newCollection = await userLibraryManager.collectionCreate(
    name,
    user.id,
  );
  return newCollection;
});
