import { ArkErrors, type } from "arktype";
import aclManager from "~/server/internal/acls";
import clientHandler from "~/server/internal/clients/handler";

const Query = type({
  id: "string",
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type APIQuery = typeof Query.inferIn;

/**
 * Fetch details about an authorization request, and claim it for the current user
 */
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, []);
  if (!userId) throw createError({ statusCode: 403 });

  const query = Query(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, statusMessage: query.summary });
  const providedClientId = query.id;

  const client = await clientHandler.fetchClient(providedClientId);
  if (!client)
    throw createError({
      statusCode: 404,
      statusMessage: "Request not found.",
    });

  if (client.userId && userId !== client.userId)
    throw createError({
      statusCode: 400,
      statusMessage: "Client already claimed.",
    });

  await clientHandler.attachUserId(providedClientId, userId);

  return client.data;
});
