import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.getUserACL(h3, ["settings:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const game = await prisma.game.findFirst();

  return { game };
});
