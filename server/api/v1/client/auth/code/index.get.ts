import { ArkErrors, type } from "arktype";
import aclManager from "~/server/internal/acls";
import clientHandler from "~/server/internal/clients/handler";

const Query = type({
  code: "string.upper",
});

/**
 * Fetch client ID by authorize code
 */
export default defineEventHandler<{ query: typeof Query.infer }>(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, []);
  if (!userId) throw createError({ statusCode: 403 });

  const query = Query(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, statusMessage: query.summary });
  const code = query.code;

  const clientId = await clientHandler.fetchClientIdByCode(code);
  if (!clientId)
    throw createError({ statusCode: 400, statusMessage: "Invalid code." });

  return clientId;
});
