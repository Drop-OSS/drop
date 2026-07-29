import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const PatchGroup = type({
  name: "2 <= string <= 50",
  description: "string = ''",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["user:delete"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const id = getRouterParam(h3, "id")!;
  const body = await readDropValidatedBody(h3, PatchGroup);

  const existing = await prisma.userGroup.findUnique({ where: { id } });
  if (!existing)
    throw createError({ statusCode: 404, message: "Group not found" });

  const nameTaken = await prisma.userGroup.findFirst({
    where: { name: body.name, id: { not: id } },
  });
  if (nameTaken)
    throw createError({ statusCode: 400, message: "Group name already exists" });

  // eslint-disable-next-line drop/no-prisma-delete
  const group = await prisma.userGroup.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
    },
  });

  return group;
});
