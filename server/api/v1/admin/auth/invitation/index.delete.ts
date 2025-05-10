import { type } from "arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const DeleteInvite = type({
  id: "string",
});

export default defineEventHandler<{
  body: typeof DeleteInvite.infer;
}>(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "auth:simple:invitation:delete",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = DeleteInvite(await readBody(h3));
  if (body instanceof type.errors) {
    // hover out.summary to see validation errors
    console.error(body.summary);

    throw createError({
      statusCode: 400,
      statusMessage: body.summary,
    });
  }

  await prisma.invitation.delete({ where: { id: body.id } });
  return {};
});
