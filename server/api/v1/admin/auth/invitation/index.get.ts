import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const user = await h3.context.session.getAdminUser(h3);
  if (!user) throw createError({ statusCode: 403 });

  const invitations = await prisma.invitation.findMany({});
  return invitations;
});
