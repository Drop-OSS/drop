import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
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

    const body = await readDropValidatedBody(h3, UpdateVersionOrder);
    const gameId = body.id;
    // We expect an array of the version names for this game
    const unsortedVersions = await prisma.gameVersion.findMany({
      where: {
        versionName: { in: body.versions },
      },
      select: {
        versionName: true,
        versionIndex: true,
        delta: true,
        platform: true,
      },
    });

    const versions = body.versions
      .map((e) => unsortedVersions.find((v) => v.versionName === e))
      .filter((e) => e !== undefined);

    if (versions.length !== unsortedVersions.length)
      throw createError({
        statusCode: 500,
        statusMessage: "Sorting versions yielded less results, somehow.",
      });

    // Validate the new order
    const has: { [key: string]: boolean } = {};
    for (const version of versions) {
      if (version.delta && !has[version.platform])
        throw createError({
          statusCode: 400,
          statusMessage: `"${version.versionName}" requires a base version to apply the delta to.`,
        });
      has[version.platform] = true;
    }

    await prisma.$transaction(
      versions.map((version, versionIndex) =>
        prisma.gameVersion.update({
          where: {
            gameId_versionName: {
              gameId: gameId,
              versionName: version.versionName,
            },
          },
          data: {
            versionIndex: versionIndex,
          },
        }),
      ),
    );

    return versions;
  },
);
