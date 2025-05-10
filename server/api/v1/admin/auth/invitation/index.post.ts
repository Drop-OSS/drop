import { type } from "arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const CreateInvite = type({
  isAdmin: "boolean",
  username: "string",
  email: "string.email",
  expires: "string.date.iso.parse",
});

export default defineEventHandler<{
  body: typeof CreateInvite.infer;
}>(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "auth:simple:invitation:new",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = CreateInvite(await readBody(h3));
  if (body instanceof type.errors) {
    // hover out.summary to see validation errors
    console.error(body.summary);

    throw createError({
      statusCode: 400,
      statusMessage: body.summary,
    });
  }

  const invitation = await prisma.invitation.create({
    data: body,
  });

  return invitation;
});
