import { type } from "arktype";
import { throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const UpdateVersionOrder = type({
  id: "string",
  versions: "string[]",
}).configure(throwingArktype);

export default defineEventHandler<{ body: typeof UpdateVersionOrder }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, [
      "game:version:update",
    ]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readValidatedBody(h3, UpdateVersionOrder);
    const gameId = body.id;
    // We expect an array of the version names for this game
    const versions = body.versions;

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
          },
        }),
      ),
    );

    return newVersions;
  },
);
