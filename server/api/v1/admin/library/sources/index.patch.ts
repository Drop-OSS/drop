import { type } from "arktype";
import { throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";
import { libraryConstructors } from "~/server/plugins/05.library-init";
import type { WorkingLibrarySource } from "./index.get";

const UpdateLibrarySource = type({
  id: "string",
  name: "string",
  options: "object",
}).configure(throwingArktype);

export default defineEventHandler<{ body: typeof UpdateLibrarySource.infer }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, [
      "library:sources:update",
    ]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readValidatedBody(h3, UpdateLibrarySource);

    const source = await prisma.library.findUnique({ where: { id: body.id } });
    if (!source)
      throw createError({
        statusCode: 400,
        statusMessage: "Library source not found",
      });

    const constructor = libraryConstructors[source.backend];

    try {
      const newLibrary = constructor(body.options, source.id);

      // Test we can actually use it
      if ((await newLibrary.listGames()) === undefined) {
        throw "Library failed to fetch games.";
      }

      const updatedSource = await prisma.library.update({
        where: {
          id: source.id,
        },
        data: {
          name: body.name,
          options: body.options,
        },
      });

      await libraryManager.removeLibrary(source.id);
      await libraryManager.addLibrary(newLibrary);

      const workingSource: WorkingLibrarySource = {
        ...updatedSource,
        working: true,
      };

      return workingSource;
    } catch (e) {
      throw createError({
        statusCode: 400,
        statusMessage: `Failed to create source: ${e}`,
      });
    }
  },
);
