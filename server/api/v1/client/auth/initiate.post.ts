import clientHandler from "~/server/internal/clients/handler";
import { parsePlatform } from "~/server/internal/utils/parseplatform";

export default defineEventHandler(async (h3) => {
  const body = await readBody(h3);

  const name = body.name;
  const platformRaw = body.platform;

  if (!name || !platformRaw)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing name or platform in body",
    });

  const platform = parsePlatform(platformRaw);
  if (!platform)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid or unsupported platform",
    });

  const clientId = await clientHandler.initiate({ name, platform });

  return `/client/${clientId}/callback`;
});
