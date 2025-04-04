import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";
import { DropManifest } from "~/server/internal/downloads/manifest";

export default defineClientEventHandler(async (h3, {}) => {
  const query = getQuery(h3);
  const id = query.id?.toString();
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "No ID in request query",
    });

  const versions = await prisma.gameVersion.findMany({
    where: {
      gameId: id,
    },
    orderBy: {
      versionIndex: "desc", // Latest one first
    },
  });

  const mappedVersions = versions
    .map((version) => {
      if (!version.dropletManifest) return undefined;
      const newVersion = { ...version, dropletManifest: undefined };
      // @ts-expect-error
      delete newVersion.dropletManifest;
      return {
        ...newVersion,
      };
    })
    .filter((e) => e);

  return mappedVersions;
});
