import { defineEventHandler, getQuery } from "h3";
import newsManager from "~/server/internal/news";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  
  const options = {
    take: query.limit ? parseInt(query.limit as string) : undefined,
    skip: query.skip ? parseInt(query.skip as string) : undefined,
    orderBy: query.order as 'asc' | 'desc',
    tags: query.tags ? (query.tags as string).split(',') : undefined,
    search: query.search as string,
  };

  const news = await newsManager.getAll(options);
  return news;
});
