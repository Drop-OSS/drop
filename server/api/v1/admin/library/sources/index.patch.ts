import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";
import type { WorkingLibrarySource } from "~/server/api/v1/admin/library/sources/index.get";
import { libraryConstructors } from "~/server/plugins/05.library-init";

const UpdateLibrarySource = type({
  id: "string",
  name: "string",
  options: "object",
}).configure(throwingArktype);

export default defineEventHandler<{ body: typeof UpdateLibrarySource.infer }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, [
      "library:sources:update",
      "setup",
    ]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readDropValidatedBody(h3, UpdateLibrarySource);

    const source = await prisma.library.findUnique({ where: { id: body.id } });
    if (!source)
      throw createError({
        statusCode: 400,
        statusMessage: "Library source not found",
      });

    const constructor = libraryConstructors[source.backend];

    const newLibrary = constructor(body.options, source.id);

    // Test we can actually use it
    if ((await newLibrary.listGames()) === undefined) {
      throw "Library failed to fetch games.";
    }

    const updatedSource = (
      await prisma.library.updateManyAndReturn({
        where: {
          id: source.id,
        },
        data: {
          name: body.name,
          options: body.options,
        },
      })
    ).at(0);
    if (!updatedSource)
      throw createError({
        statusCode: 404,
        message: "Library source not found",
      });

    libraryManager.removeLibrary(source.id);
    libraryManager.addLibrary(newLibrary);

    const workingSource: WorkingLibrarySource = {
      ...updatedSource,
      working: true,
    };

    return workingSource;
  },
);
