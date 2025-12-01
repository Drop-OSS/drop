import { ArkErrors, type } from "arktype";
import aclManager from "~/server/internal/acls";
import contextManager from "~/server/internal/downloads/coordinator";

const Query = type({
  game: "string",
  version: "string",
});

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["depot"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const query = Query(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, message: query.summary });

  const contextId = await contextManager.createContext(
    query.game,
    query.version,
  );
  if (!contextId)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid game or version",
    });

  const contextObject = await contextManager.fetchContext(contextId);

  return contextObject!;
});
