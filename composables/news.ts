export const useNews = () => {
  const getAll = async (options?: {
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

    return await useFetch(`/api/v1/news?${query.toString()}`);
  };

  const getById = async (id: string) => {
    return await useFetch(`/api/v1/news/${id}`);
  };

  const remove = async (id: string) => {
    return await $dropFetch(`/api/v1/admin/news/${id}`, {
      method: "DELETE",
    });
  };

  return {
    getAll,
    getById,
    remove,
  };
};
