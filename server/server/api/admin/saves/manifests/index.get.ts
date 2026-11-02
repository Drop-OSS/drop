import { createError, defineEventHandler } from "h3";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["settings:update"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });

  const manifests = await prisma.saveManifest.findMany({
    select: {
      id: true,
      gameId: true,
      source: true,
      ludusaviName: true,
      updatedAt: true,
      entry: true,
      game: { select: { mName: true, metadataId: true } },
    },
    orderBy: { game: { mName: "asc" } },
  });

  return manifests.map((manifest) => ({
    id: manifest.id,
    gameId: manifest.gameId,
    game: manifest.game.mName,
    metadataId: manifest.game.metadataId,
    source: manifest.source,
    ludusaviName: manifest.ludusaviName,
    updatedAt: manifest.updatedAt,
    fileCount: Object.keys(
      (manifest.entry as { files?: Record<string, unknown> }).files ?? {},
    ).length,
    registryCount: Object.keys(
      (manifest.entry as { registry?: Record<string, unknown> }).registry ?? {},
    ).length,
  }));
});
