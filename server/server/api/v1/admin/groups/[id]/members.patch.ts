import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const PatchMembers = type({
  userIds: "string[]",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["user:delete"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const id = getRouterParam(h3, "id")!;
  const body = await readDropValidatedBody(h3, PatchMembers);

  const group = await prisma.userGroup.findUnique({ where: { id } });
  if (!group)
    throw createError({ statusCode: 404, message: "Group not found" });

  // SAFETY: existence verified above via findUnique
  // eslint-disable-next-line drop/no-prisma-delete
  await prisma.userGroup.update({
    where: { id },
    data: {
      users: { set: body.userIds.map((uid) => ({ id: uid })) },
    },
  });

  const updated = await prisma.userGroup.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  });

  return updated;
});
