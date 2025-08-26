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
    // We expect an array of the version names for this game
    const versions = body.versions;

    await prisma.$transaction(
      versions.map((versionId, versionIndex) =>
        prisma.gameVersion.update({
          where: {
            versionId,
          },
          data: {
            versionIndex: versionIndex,
          },
          select: {},
        }),
      ),
    );

    setResponseStatus(h3, 201);
    return;
  },
);
