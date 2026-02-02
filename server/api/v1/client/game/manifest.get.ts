import { createDownloadManifestDetails } from "~/server/internal/library/manifest/index";

export default defineEventHandler(async (h3) => {
  const query = getQuery(h3);
  const version = query.version?.toString();
  if (!version)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing version ID in query",
    });

  const result = await createDownloadManifestDetails(version);
  console.log(result);
  return result;
});
