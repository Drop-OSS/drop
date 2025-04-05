import { defineEventHandler, getQuery } from "h3";
import aclManager from "~/server/internal/acls";
import newsManager from "~/server/internal/news";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["news:read"]);
  if (!allowed)
    throw createError({
      statusCode: 403,
    });

  const query = getQuery(h3);

  const orderBy = query.order as "asc" | "desc";
  if (orderBy) {
    if (typeof orderBy !== "string" || !["asc", "desc"].includes(orderBy))
      throw createError({ statusCode: 400, statusMessage: "Invalid order" });
  }

  const tags = query.tags as string[] | undefined;
  if (tags) {
    if (typeof tags !== "object" || !Array.isArray(tags))
      throw createError({ statusCode: 400, statusMessage: "Invalid tags" });
  }

  const options = {
    take: parseInt(query.limit as string),
    skip: parseInt(query.skip as string),
    orderBy: orderBy,
    ...(tags && { tags: tags
      .map((e) => e.toString()) }),
    search: query.search as string,
  };

  const news = await newsManager.fetch(options);
  return news;
});
