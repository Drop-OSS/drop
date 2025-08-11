import { ArkErrors, type } from "arktype";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import manifestGenerator from "~/server/internal/downloads/manifest";

const Query = type({
  id: "string",
  version: "string",
});

/**
 * Fetch Droplet manifest from game ID and version
 * @request `id` and `version` query params are required.
 */
export default defineClientEventHandler(async (h3) => {
  const query = Query(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, statusMessage: query.summary });

  const id = query.id;
  const version = query.version;

  const manifest = await manifestGenerator.generateManifest(id, version);
  if (!manifest)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid game or version, or no versions added.",
    });
  return manifest;
});
