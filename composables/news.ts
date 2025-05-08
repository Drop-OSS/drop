import type { Article } from "~/prisma/client";
import type { SerializeObject } from "nitropack";

export const useNews = () =>
  useState<
    | Array<
        SerializeObject<
          Article & {
            tags: Array<{ id: string; name: string }>;
            author: { displayName: string; id: string } | null;
          }
        >
      >
    | undefined
  >("news", () => undefined);

export const fetchNews = async (options?: {
  limit?: number;
  skip?: number;
  orderBy?: "asc" | "desc";
  tags?: string[];
  search?: string;
}) => {
  const query = new URLSearchParams();

  if (options?.limit) query.set("limit", options.limit.toString());
  if (options?.skip) query.set("skip", options.skip.toString());
  if (options?.orderBy) query.set("order", options.orderBy);
  if (options?.tags?.length) query.set("tags", options.tags.join(","));
  if (options?.search) query.set("search", options.search);

  const news = useNews();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore forget why this ignor exists
  const newValue = await $dropFetch(`/api/v1/news?${query.toString()}`);

  news.value = newValue;

  return newValue;
};
