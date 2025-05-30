import { type } from "arktype";
import { throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const DeleteVersion = type({
  id: "string",
  versionName: "string",
}).configure(throwingArktype);

export default defineEventHandler<{ body: typeof DeleteVersion }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, [
      "game:version:delete",
    ]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readValidatedBody(h3, DeleteVersion);

    const gameId = body.id.toString();
    const version = body.versionName.toString();

    await prisma.gameVersion.delete({
      where: {
        gameId_versionName: {
          gameId: gameId,
          versionName: version,
        },
      },
    });

    return {};
  },
);
