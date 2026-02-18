import { ArkErrors, type } from "arktype";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { createDownloadManifestDetails } from "~/server/internal/library/manifest/index";

const Query = type({
  version: "string",
  previous: "string?",
  refresh: "string?",
});

export default defineClientEventHandler(async (h3) => {
  const query = Query(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, message: query.summary });

  const result = await createDownloadManifestDetails(
    query.version,
    query.previous,
    query.refresh == "true",
  );
  return result;
});
