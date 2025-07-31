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
      statusMessage: "Invalid or expired client ID.",
    });

  if (client.userId != user.userId)
    throw createError({
      statusCode: 403,
      statusMessage: "Not allowed to authorize this client.",
    });

  if (!client.peer)
    throw createError({
      statusCode: 500,
      statusMessage: "No client listening for authorization.",
    });

  const token = await clientHandler.generateAuthToken(clientId);

  await client.peer.send(`${clientId}/${token}`);

  return;
});
