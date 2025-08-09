import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const GameDelete = type({
  id: "string",
}).configure(throwingArktype);

/**
 * Delete a game's association with a company
 * @param id Company ID
 */
export default defineEventHandler<{ body: typeof GameDelete.infer }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, ["company:update"]);
    if (!allowed) throw createError({ statusCode: 403 });

    const companyId = getRouterParam(h3, "id")!;

    const body = await readDropValidatedBody(h3, GameDelete);

    await prisma.game.update({
      where: {
        id: body.id,
      },
      data: {
        publishers: {
          disconnect: {
            id: companyId,
          },
        },
        developers: {
          disconnect: {
            id: companyId,
          },
        },
      },
    });

    return;
  },
);
