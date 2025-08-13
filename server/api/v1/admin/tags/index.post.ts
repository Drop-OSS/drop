import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const CreateTag = type({
  name: "string",
}).configure(throwingArktype);

/**
 * Create a game tag
 */
export default defineEventHandler<{ body: typeof CreateTag.infer }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, ["tags:read"]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readDropValidatedBody(h3, CreateTag);

    const tag = await prisma.gameTag.create({
      data: {
        ...body,
      },
    });
    return tag;
  },
);
