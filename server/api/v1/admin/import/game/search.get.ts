import { ArkErrors, type } from "arktype";
import aclManager from "~/server/internal/acls";
import metadataHandler from "~/server/internal/metadata";

const SearchGame = type({
  q: "string",
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type APIQuery = typeof SearchGame.infer;

/**
 * Search metadata providers for a query. Results can be used to import a game with metadata.
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:game:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const query = getQuery(h3);
  const search = SearchGame(query);
  if (search instanceof ArkErrors)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid search: " + search.summary,
    });

  const results = await metadataHandler.search(search.q);

  if (results.length == 0)
    throw createError({
      statusCode: 404,
      statusMessage: "No metadata provider returned search results.",
    });

  return results;
});
