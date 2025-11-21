import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const DeleteInvite = type({
  id: "string",
}).configure(throwingArktype);

export default defineEventHandler<{
  body: typeof DeleteInvite.infer;
}>(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "auth:simple:invitation:delete",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, DeleteInvite);

  const { count } = await prisma.invitation.deleteMany({
    where: { id: body.id },
  });
  if (count == 0)
    throw createError({ statusCode: 404, message: "Invitation not found." });
  return {};
});
