import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const PatchTags = type({
  tags: "string[]",
}).configure(throwingArktype);

/**
 * Update the tags associated with this game.
 * @param id Game ID
 */
export default defineEventHandler<{ body: typeof PatchTags.infer }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, ["game:update"]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readDropValidatedBody(h3, PatchTags);
    const id = getRouterParam(h3, "id")!;

    await prisma.game.update({
      where: {
        id,
      },
      data: {
        tags: {
          connect: body.tags.map((e) => ({ id: e })),
        },
      },
    });

    return;
  },
);
