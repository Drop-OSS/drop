import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

const DeleteLibrarySource = type({
  id: "string",
}).configure(throwingArktype);

export default defineEventHandler<{ body: typeof DeleteLibrarySource.infer }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, [
      "library:sources:delete",
    ]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readDropValidatedBody(h3, DeleteLibrarySource);

    await prisma.library.delete({
      where: {
        id: body.id,
      },
    });

    libraryManager.removeLibrary(body.id);
  },
);
