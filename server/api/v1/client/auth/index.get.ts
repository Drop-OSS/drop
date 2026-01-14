import clientHandler from "~/server/internal/clients/handler";
import sessionHandler from "~/server/internal/session";

export default defineEventHandler(async (h3) => {
  const session = await sessionHandler.getSession(h3);
  if (!session || !session.authenticated)
    throw createError({ statusCode: 403 });

  const query = getQuery(h3);
  const providedClientId = query.id?.toString();
  if (!providedClientId)
    throw createError({
      statusCode: 400,
      statusMessage: "Provide client ID in request params as 'id'",
    });

  const client = await clientHandler.fetchClient(providedClientId);
  if (!client)
    throw createError({
      statusCode: 404,
      statusMessage: "Request not found.",
    });

  if (client.userId && session.authenticated.userId !== client.userId)
    throw createError({
      statusCode: 400,
      statusMessage: "Client already claimed.",
    });

  await clientHandler.attachUserId(
    providedClientId,
    session.authenticated.userId,
  );

  return client.data;
});
