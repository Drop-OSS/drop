import type { LibraryBackend } from "~/prisma/client/enums";
import prisma from "../internal/db/database";
import type { JsonValue } from "@prisma/client/runtime/library";
import type { LibraryProvider } from "../internal/library/provider";
import { FilesystemProvider } from "../internal/library/providers/filesystem";
import libraryManager from "../internal/library";
import { FlatFilesystemProvider } from "../internal/library/providers/flat";
import { logger } from "~/server/internal/logging";

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
  FlatFilesystem: function (
    value: JsonValue,
    id: string,
  ): LibraryProvider<unknown> {
    return new FlatFilesystemProvider(value, id);
  },
};

export default defineNitroPlugin(async () => {
  let successes = 0;
  const libraries = await prisma.library.findMany({});

  for (const library of libraries) {
    const constructor = libraryConstructors[library.backend];
    try {
      const provider = constructor(library.options, library.id);
      libraryManager.addLibrary(provider);
      successes++;
    } catch (e) {
      logger.warn(
        `Failed to create library (${library.id}) of type ${library.backend}:\n ${e}`,
      );
    }
  }

  if (successes == 0) {
    logger.warn(
      "No library was successfully initialised. Please check for errors. If you have just set up an instance, this is normal.",
    );
  }
});
