import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const user = await h3.context.session.getAdminUser(h3);
  if (!user) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const isAdmin = body.isAdmin;
  const username = body.username;
  const email = body.email;

  if (isAdmin !== undefined && typeof isAdmin !== "boolean")
    throw createError({
      statusCode: 400,
      statusMessage: "isAdmin must be a boolean",
    });

  const invitation = await prisma.invitation.create({
    data: {
      isAdmin: isAdmin,
      username: username,
      email: email,
    },
  });

  return invitation;
});
