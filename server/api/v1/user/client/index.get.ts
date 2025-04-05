import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["clients:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const clients = await prisma.client.findMany({
    where: {
      userId,
    },
  });

  return clients;
});
