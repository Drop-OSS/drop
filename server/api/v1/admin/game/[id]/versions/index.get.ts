import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const id = getRouterParam(h3, "id")!;

  const game = await prisma.game.findUnique({
    where: {
      id,
    },
    select: {
      versions: {
        select: {
          versionId: true,
          displayName: true,
          versionPath: true,
          launches: {
            select: {
              launchId: true,
              command: true,
              name: true,
              platform: true,
            },
          },
        },
      },
    },
  });
  if (!game) throw createError({ statusCode: 404, message: "Game not found" });

  return game.versions;
});
