import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

/**
 * Fetch all versions for game ID
 * @request `id` required in query params
 */
export default defineClientEventHandler(async (h3) => {
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
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore idk why we delete an undefined object
      delete newVersion.dropletManifest;
      return {
        ...newVersion,
      };
    })
    .filter((e) => e);

  return mappedVersions;
});
