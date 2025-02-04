import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "auth:simple:invitation:new",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const isAdmin = body.isAdmin;
  const username = body.username;
  const email = body.email;
  const expires = body.expires;

  if (!expires)
    throw createError({ statusCode: 400, statusMessage: "No expires field." });
  if (isAdmin !== undefined && typeof isAdmin !== "boolean")
    throw createError({
      statusCode: 400,
      statusMessage: "isAdmin must be a boolean",
    });

  const expiresDate = new Date(expires);
  if (!(expiresDate instanceof Date && !isNaN(expiresDate.getTime())))
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid expires date",
    });

  const invitation = await prisma.invitation.create({
    data: {
      isAdmin: isAdmin,
      username: username,
      email: email,
      expires: expiresDate,
    },
  });

  return invitation;
});
