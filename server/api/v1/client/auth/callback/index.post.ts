import clientHandler from "~/server/internal/clients/handler";
import sessionHandler from "~/server/internal/session";

export default defineEventHandler(async (h3) => {
  const user = await sessionHandler.getSession(h3);
  if (!user) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const clientId = await body.id;

  const data = await clientHandler.fetchClientMetadata(clientId);
  if (!data)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid or expired client ID.",
    });

  const token = await clientHandler.generateAuthToken(clientId);

  return {
    redirect: `drop://handshake/${clientId}/${token}`,
    token: `${clientId}/${token}`,
  };
});
