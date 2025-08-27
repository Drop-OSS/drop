import clientHandler from "~/server/internal/clients/handler";
import sessionHandler from "~/server/internal/session";

export default defineEventHandler(async (h3) => {
  const user = await sessionHandler.getSession(h3);
  if (!user) throw createError({ statusCode: 403 });

  const query = getQuery(h3);
  const providedClientId = query.id?.toString();
  if (!providedClientId)
    throw createError({
      statusCode: 400,
      message: "Provide client ID in request params as 'id'",
    });

  const client = await clientHandler.fetchClient(providedClientId);
  if (!client)
    throw createError({
      statusCode: 404,
      message: "Request not found.",
    });

  if (client.userId && user.userId !== client.userId)
    throw createError({
      statusCode: 400,
      message: "Client already claimed.",
    });

  await clientHandler.attachUserId(providedClientId, user.userId);

  return client.data;
});
