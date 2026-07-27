import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const CreateGroup = type({
  name: "2 <= string <= 50",
  description: "string = ''",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["user:delete"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, CreateGroup);

  const existing = await prisma.userGroup.findUnique({
    where: { name: body.name },
  });
  if (existing)
    throw createError({ statusCode: 400, message: "Group name already exists" });

  const group = await prisma.userGroup.create({
    data: {
      name: body.name,
      description: body.description,
    },
  });

  return group;
});
