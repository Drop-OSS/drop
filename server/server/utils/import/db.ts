import { createError } from "h3";
import { randomUUID } from "node:crypto";
import { LibraryBackend, MetadataSource } from "~/prisma/client/enums";
import prisma from "~/server/internal/db/database";
import type { ImportDatabase } from "./session";

/** The library imported titles land in when the server has none named otherwise. */
const IMPORTED_LIBRARY = "Imported";

/** Title -> library path, matching the manifest path rules for a folder name. */
function importedLibraryPath(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "game"
  );
}

/**
 * Prisma implementation of the import database port. An imported release
 * carries no V2 droplet manifest - there is no upstream depot behind it - so
 * the version stores the `gamedepot-droplet` v1 document itself in the
 * manifest field (as text, like every other version) and pins
 * `casManifestDigest`. A client that can read the chunk store serves it; the
 * upstream torrential path is guarded to refuse these versions.
 */
export function prismaImportDatabase(): ImportDatabase {
  return {
    async findGame(id) {
      const game = await prisma.game.findUnique({
        where: { id },
        select: { id: true, mName: true },
      });
      return game ? { id: game.id, name: game.mName } : null;
    },

    async createImportedGame({ title, digest }) {
      let library = await prisma.library.findFirst({
        where: { name: IMPORTED_LIBRARY },
        orderBy: { id: "asc" },
      });
      if (!library)
        // No unique constraint on Library.name, so this is a plain
        // find-or-create; a racing double-create is harmless because every
        // later lookup takes the oldest row.
        library = await prisma.library.create({
          data: {
            name: IMPORTED_LIBRARY,
            backend: LibraryBackend.Filesystem,
            options: {},
          },
        });
      const libraryPath = importedLibraryPath(title);
      const clash = await prisma.game.findFirst({
        where: { libraryId: library.id, libraryPath },
        select: { id: true, mName: true },
      });
      if (clash)
        throw createError({
          statusCode: 409,
          statusMessage: `A game named "${clash.mName}" already occupies this import path; import this release as a new version of that game instead`,
        });
      const id = randomUUID();
      await prisma.game.create({
        data: {
          id,
          metadataSource: MetadataSource.Manual,
          // The content digest is the Manual metadata identity: re-creating
          // the same release is a duplicate, a new version is a new digest.
          metadataId: digest,
          mName: title,
          mShortDescription: "",
          mDescription: "",
          mReleased: new Date(),
          mIconObjectId: "",
          mBannerObjectId: "",
          mCoverObjectId: "",
          mImageLibraryObjectIds: [],
          libraryId: library.id,
          libraryPath,
        },
      });
      return id;
    },

    async nextVersionIndex(gameId) {
      const largest = await prisma.gameVersion.findFirst({
        where: { gameId },
        orderBy: { versionIndex: "desc" },
        select: { versionIndex: true },
      });
      return largest ? largest.versionIndex + 1 : 0;
    },

    async createImportedVersion({
      gameId,
      displayName,
      manifest,
      casManifestDigest,
      fileList,
      versionIndex,
      runsStandalone,
    }) {
      const version = await prisma.gameVersion.create({
        data: {
          game: { connect: { id: gameId } },
          displayName,
          versionPath: null,
          dropletManifest: JSON.stringify(manifest),
          casManifestDigest,
          fileList,
          versionIndex,
          runsStandalone,
        },
      });
      return version.versionId;
    },
  };
}
