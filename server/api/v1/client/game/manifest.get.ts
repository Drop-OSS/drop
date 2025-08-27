import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import manifestGenerator from "~/server/internal/downloads/manifest";

export default defineClientEventHandler(async (h3) => {
  const query = getQuery(h3);
  const id = query.id?.toString();
  if (!id)
    throw createError({
      statusCode: 400,
      message: "Missing version id in query",
    });

  const manifest = await manifestGenerator.generateManifest(id);
  if (!manifest)
    throw createError({
      statusCode: 400,
      message: "Invalid game or version, or no versions added.",
    });
  return manifest;
});
