import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import manifestGenerator from "~/server/internal/downloads/manifest";

export default defineClientEventHandler(async (h3) => {
  const query = getQuery(h3);
  const id = query.id?.toString();
  const version = query.version?.toString();
  if (!id || !version)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing id or version in query",
    });

  const manifest = await manifestGenerator.generateManifest(id, version);
  return manifest;
});
