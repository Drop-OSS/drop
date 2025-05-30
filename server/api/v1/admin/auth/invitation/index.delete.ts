import { type } from "arktype";
import { throwingArktype } from "~/server/arktype";
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

  const body = await readValidatedBody(h3, DeleteInvite);

  await prisma.invitation.delete({ where: { id: body.id } });
  return {};
});
