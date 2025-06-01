import { LibraryBackend } from "~/prisma/client";
import prisma from "../internal/db/database";
import type { JsonValue } from "@prisma/client/runtime/library";
import type { LibraryProvider } from "../internal/library/provider";
import type { FilesystemProviderConfig } from "../internal/library/filesystem";
import { FilesystemProvider } from "../internal/library/filesystem";
import libraryManager from "../internal/library";
import path from "path";

export const libraryConstructors: {
  [key in LibraryBackend]: (
    value: JsonValue,
    id: string,
  ) => LibraryProvider<unknown>;
} = {
  Filesystem: function (
    value: JsonValue,
    id: string,
  ): LibraryProvider<unknown> {
    return new FilesystemProvider(value, id);
  },
};

export default defineNitroPlugin(async () => {
  let successes = 0;
  const libraries = await prisma.library.findMany({});

  // Add migration handler
  const legacyPath = process.env.LIBRARY;
  if (legacyPath && libraries.length == 0) {
    const options: typeof FilesystemProviderConfig.infer = {
      baseDir: path.resolve(legacyPath),
    };

    const library = await prisma.library.create({
      data: {
        name: "Auto-created",
        backend: LibraryBackend.Filesystem,
        options,
      },
    });

    libraries.push(library);

    // Update all existing games
    await prisma.game.updateMany({
      where: {
        libraryId: null,
      },
      data: {
        libraryId: library.id,
      },
    });
  }

  for (const library of libraries) {
    const constructor = libraryConstructors[library.backend];
    try {
      const provider = constructor(library.options, library.id);
      libraryManager.addLibrary(provider);
      successes++;
    } catch (e) {
      console.warn(
        `Failed to create library (${library.id}) of type ${library.backend}:\n ${e}`,
      );
    }
  }

  if (successes == 0) {
    console.warn(
      "No library was successfully initialised. Please check for errors. If you have just set up an instance, this is normal.",
    );
  }
});
