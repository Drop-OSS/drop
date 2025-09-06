import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["redist:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const id = getRouterParam(h3, "id")!;

  const redist = await prisma.redist.findUnique({
    where: {
      id,
    },
    include: {
      platform: true,
      versions: true,
    },
  });
  if (!redist)
    throw createError({
      statusCode: 404,
      message: "Redistributable not found.",
    });

  const unimportedVersions = await libraryManager.fetchUnimportedGameVersions(
    redist.libraryId,
    redist.libraryPath,
  );

  if (!unimportedVersions)
    throw createError({
      statusCode: 500,
      message: "Failed to fetch unimported versions for redistributable.",
    });

  return { redist, unimportedVersions };
});
