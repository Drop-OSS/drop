import { type } from "arktype";
import { throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const CreateInvite = type({
  isAdmin: "boolean?",
  username: "string?",
  email: "string.email?",
  expires: "string.date.iso.parse",
}).configure(throwingArktype);

export default defineEventHandler<{
  body: typeof CreateInvite.infer;
}>(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "auth:simple:invitation:new",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readValidatedBody(h3, CreateInvite);

  const invitation = await prisma.invitation.create({
    data: body,
  });

  return invitation;
});
