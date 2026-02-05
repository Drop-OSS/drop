import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";

const CreateCollection = type({
  name: "string",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["collections:new"]);
  if (!userId)
    throw createError({
      statusCode: 403,
    });

  const body = await readDropValidatedBody(h3, CreateCollection);

  // Create the collection using the manager
  const newCollection = await userLibraryManager.collectionCreate(
    body.name,
    userId,
  );
  return newCollection;
});
