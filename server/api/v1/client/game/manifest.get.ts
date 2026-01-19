import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(async (h3) => {
  const query = getQuery(h3);
  const version = query.version?.toString();
  if (!version)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing version ID in query",
    });

  const manifest = await prisma.gameVersion.findUnique({
    where: { versionId: version },
    select: { dropletManifest: true },
  });
  if (!manifest)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid game or version, or no versions added.",
    });
  return manifest.dropletManifest;
});
