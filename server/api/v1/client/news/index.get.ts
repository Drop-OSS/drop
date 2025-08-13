import { ArkErrors, type } from "arktype";
import { getQuery } from "h3";
import aclManager from "~/server/internal/acls";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import newsManager from "~/server/internal/news";

const NewsFetch = type({
  "order?": "'asc' | 'desc'",
  "tags?": "string[]",
  "limit?": "string.numeric.parse",
  "skip?": "string.numeric.parse",
  "search?": "string",
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type APIQuery = typeof NewsFetch.infer;

/**
 * Fetch instance news articles
 */
export default defineClientEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["news:read"]);
  if (!userId)
    throw createError({
      statusCode: 403,
      statusMessage: "Requires authentication",
    });

  const query = NewsFetch(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, statusMessage: query.summary });

  const orderBy = query.order;
  const tags = query.tags;

  const options = {
    take: Math.min(query.limit ?? 10, 10),
    skip: query.skip ?? 0,
    orderBy: orderBy,
    ...(tags && { tags: tags.map((e) => e.toString()) }),
    search: query.search,
  };

  const news = await newsManager.fetch(options);
  return news;
});
