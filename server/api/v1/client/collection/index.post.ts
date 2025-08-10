import { type } from "arktype";
import { throwingArktype } from "~/server/arktype";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import userLibraryManager from "~/server/internal/userlibrary";

const CreateCollection = type({
  name: "string",
}).configure(throwingArktype);

/**
 * Create new collection
 */
export default defineClientEventHandler(async (h3, { fetchUser, body }) => {
  const user = await fetchUser();

  const name = body.name;

  // Create the collection using the manager
  const newCollection = await userLibraryManager.collectionCreate(
    name,
    user.id,
  );
  return newCollection;
}, CreateCollection);
