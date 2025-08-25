import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const DeleteVersion = type({
  id: "string",
}).configure(throwingArktype);

export default defineEventHandler<{ body: typeof DeleteVersion }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, [
      "game:version:delete",
    ]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readDropValidatedBody(h3, DeleteVersion);

    await prisma.version.delete({
      where: {
        versionId: body.id,
      },
    });

    return {};
  },
);
