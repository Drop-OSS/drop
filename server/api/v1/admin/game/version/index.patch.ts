import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "game:version:update",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const gameId = body.id?.toString();
  // We expect an array of the version names for this game
  const versions: string[] | undefined = body.versions;
  if (!gameId || !versions || !Array.isArray(versions))
    throw createError({
      statusCode: 400,
      statusMessage: "Missing id, versions or versions is not an array",
    });

  const newVersions = await prisma.$transaction(
    versions.map((versionName, versionIndex) =>
      prisma.gameVersion.update({
        where: {
          gameId_versionName: {
            gameId: gameId,
            versionName: versionName,
          },
        },
        data: {
          versionIndex: versionIndex,
        },
        select: {
            versionIndex: true,
            versionName: true,
            platform: true,
            delta: true,
        }
      })
    )
  );

  return newVersions;
});
