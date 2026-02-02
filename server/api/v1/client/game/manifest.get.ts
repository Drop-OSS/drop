import { createDownloadManifestDetails } from "~/server/internal/library/manifest/index";

export default defineEventHandler(async (h3) => {
  const query = getQuery(h3);
  const version = query.version?.toString();
  console.log("[DEBUG] /api/v1/client/game/manifest called with version:", version);
  if (!version)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing version ID in query",
    });

  const result = await createDownloadManifestDetails(version);
  const manifest = result.manifests[version];
  if (!manifest)
    throw createError({
      statusCode: 404,
      statusMessage: "Manifest not found for version",
    });
  console.log(result);
  return {
    ...manifest,
    ...result,
    version: "2",
  };
});
