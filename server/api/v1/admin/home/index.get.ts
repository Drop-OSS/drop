import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { systemConfig } from "~/server/internal/config/sys-conf";
import { DateTime } from "luxon";
import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const sources = await libraryManager.fetchLibraries();

  const activeUserCount = await prisma.user.count({
    where: {
      id: { not: "system" },
      clients: {
        every: {
          lastConnected: {
            lt: DateTime.now().plus({ months: 1 }).toISO(),
          },
        },
      },
    },
  });

  return {
    gameCount: await prisma.game.count(),
    version: systemConfig.getDropVersion(),
    userCount: await prisma.user.count({
      where: { id: { not: "system" } },
    }),
    activeUserCount,
    sources,
  };
});
