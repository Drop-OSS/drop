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
      statusMessage: "Provide client ID in request params as 'id'",
    });

  const data = await clientHandler.fetchClientMetadata(providedClientId);
  if (!data)
    throw createError({
      statusCode: 404,
      statusMessage: "Request not found.",
    });

  await clientHandler.attachUserId(providedClientId, user.userId);

  return data;
});
