import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { systemConfig } from "~/server/internal/config/sys-conf";
import { DateTime } from "luxon";
import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const sources = await libraryManager.fetchLibraries();

  const activeSessions = (
    await prisma.client.groupBy({
      by: ["userId"],
      where: {
        id: { not: "system" },
        lastConnected: {
          gt: DateTime.now().minus({ months: 1 }).toISO(),
        },
      },
    })
  ).length;

  return {
    gameCount: await prisma.game.count(),
    version: systemConfig.getDropVersion(),
    userCount: await prisma.user.count({
      where: { id: { not: "system" } },
    }),
    activeSessions,
    sources,
  };
});
