import clientHandler from "~/server/internal/clients/handler";

export default defineEventHandler(async (h3) => {
  const body = await readBody(h3);

  const name = body.name;
  const platform = body.platform;

  if (!name || !platform)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing name or platform in body",
    });

  const clientId = await clientHandler.initiate({ name, platform });

  return `/client/${clientId}/callback`;
});
