import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const GamePatch = type({
  action: "'developed' | 'published'",
  enabled: "boolean",
  id: "string",
}).configure(throwingArktype);

/**
 * Update a company's association with a game.
 * @param id Company ID
 */
export default defineEventHandler<{ body: typeof GamePatch.infer }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, ["company:update"]);
    if (!allowed) throw createError({ statusCode: 403 });

    const companyId = getRouterParam(h3, "id")!;

    const body = await readDropValidatedBody(h3, GamePatch);

    const action = body.action === "developed" ? "developers" : "publishers";
    const actionType = body.enabled ? "connect" : "disconnect";

    await prisma.game.update({
      where: {
        id: body.id,
      },
      data: {
        [action]: {
          [actionType]: {
            id: companyId,
          },
        },
      },
    });

    return;
  },
);
