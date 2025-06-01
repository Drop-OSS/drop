import { type } from "arktype";
import { randomUUID } from "crypto";
import { LibraryBackend } from "~/prisma/client";
import { throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";
import { libraryConstructors } from "~/server/plugins/05.library-init";
import type { WorkingLibrarySource } from "./index.get";

const CreateLibrarySource = type({
  name: "string",
  backend: "string",
  options: "object",
}).configure(throwingArktype);

export default defineEventHandler<{ body: typeof CreateLibrarySource.infer }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, [
      "library:sources:new",
    ]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readValidatedBody(h3, CreateLibrarySource);
    const backend = Object.values(LibraryBackend).find(
      (e) => e == body.backend,
    );
    if (!backend)
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid source backend.",
      });

    const constructor = libraryConstructors[backend];

    try {
      const id = randomUUID();
      const library = constructor(body.options, id);

      // Test we can actually use it
      if ((await library.listGames()) === undefined) {
        throw "Library failed to fetch games.";
      }

      const source = await prisma.library.create({
        data: {
          id,
          name: body.name,
          backend,
          options: body.options,
        },
      });

      await libraryManager.addLibrary(library);

      const workingSource: WorkingLibrarySource = {
        ...source,
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
