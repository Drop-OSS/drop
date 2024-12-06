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
    select: {
      versionIndex: true,
      versionName: true,
      platform: true,
      setupCommand: true,
      launchCommand: true,
      delta: true,
      dropletManifest: true,
    },
    orderBy: {
      versionIndex: "desc", // Latest one first
    },
  });

  const mappedVersions = versions
    .map((version) => {
      if (!version.dropletManifest) return undefined;
      const manifest = JSON.parse(
        version.dropletManifest.toString()
      ) as DropManifest;

      /*
      TODO: size estimates
      They are a little complicated because of delta versions
      Manifests need to be generated with the manifest generator and then
      added up. I'm a little busy right now to implement this, though.
      */

      const newVersion = { ...version, dropletManifest: undefined };
      delete newVersion.dropletManifest;
      return {
        ...newVersion,
      };
    })
    .filter((e) => e);

  return mappedVersions;
});
