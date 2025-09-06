import clientHandler from "~/server/internal/clients/handler";
import sessionHandler from "~/server/internal/session";

export default defineEventHandler(async (h3) => {
  const user = await sessionHandler.getSession(h3);
  if (!user) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const clientId = await body.id;

  const client = await clientHandler.fetchClient(clientId);
  if (!client)
    throw createError({
      statusCode: 400,
      message: "Invalid or expired client ID.",
    });

  if (client.userId != user.userId)
    throw createError({
      statusCode: 403,
      message: "Not allowed to authorize this client.",
    });

  const token = await clientHandler.generateAuthToken(clientId);

  return {
    redirect: `drop://handshake/${clientId}/${token}`,
    token: `${clientId}/${token}`,
  };
});
