import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { libraryManager } from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const games = await prisma.game.findMany({
    select: {
      id: true,
      mName: true,
      mIconObjectId: true,
      versions: {
        select: {
          versionPath: true,
        },
      },
      unimportedGameVersions: {
        select: {
          id: true,
          versionName: true,
        },
      },
      libraryId: true,
      libraryPath: true,
    },
  });

  const unimportedVersions = await Promise.all(
    games.map(async (v) => ({
      id: v.id,
      name: v.mName,
      icon: v.mIconObjectId,
      versions: await libraryManager.fetchUnimportedGameVersions(
        v.libraryId,
        v.libraryPath,
        {
          gameId: v.id,
          versions: v.versions
            .map((v) => v.versionPath)
            .filter((v) => v !== null),
          depotVersions: v.unimportedGameVersions,
        },
      ),
    })),
  );

  const onlyUnimported = unimportedVersions.filter(
    (v) => v.versions && v.versions.length > 0,
  );

  return onlyUnimported;
});
