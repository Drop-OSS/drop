import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import userLibraryManager from "~/server/internal/userlibrary";

const CreateCollection = type({
  name: "string",
}).configure(throwingArktype);

export default defineEventHandler<{ body: typeof CreateCollection.infer }>(
  async (h3) => {
    const userId = await aclManager.getUserIdACL(h3, ["collections:read"]);
    if (!userId)
      throw createError({
        statusCode: 403,
      });

    const body = await readDropValidatedBody(h3, CreateCollection);
    const name = body.name;

    // Create the collection using the manager
    const newCollection = await userLibraryManager.collectionCreate(
      name,
      userId,
    );
    return newCollection;
  },
);
