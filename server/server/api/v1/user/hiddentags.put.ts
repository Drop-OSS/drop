import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const SetHiddenTags = type({
  tags: "string[]",
}).configure(throwingArktype);

// Replaces the set of tags this user has hidden. Unknown ids are ignored.
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["hiddentags:update"]);
  if (!userId) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, SetHiddenTags);
  const tags = await prisma.gameTag.findMany({
    where: { id: { in: body.tags } },
    select: { id: true },
  });

  // SAFETY: the id comes from the signed-in session, so the user exists
  // eslint-disable-next-line drop/no-prisma-delete
  const user = await prisma.user.update({
    where: { id: userId },
    data: { hiddenTags: { set: tags } },
    select: { hiddenTags: { select: { id: true } } },
  });
  return user.hiddenTags.map((t) => t.id);
});
