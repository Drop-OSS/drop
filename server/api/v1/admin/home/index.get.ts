import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { systemConfig } from "~/server/internal/config/sys-conf";
import libraryManager from "~/server/internal/library";
import userStatsManager from "~/server/internal/userstats";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const sources = await libraryManager.fetchLibraries();
  const userStats = await userStatsManager.getUserStats();
  return {
    gameCount: await prisma.game.count(),
    version: systemConfig.getDropVersion(),
    userStats,
    sources,
  };
});
