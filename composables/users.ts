import type { SerializeObject } from "nitropack";
import type { User, AuthMec } from "~/prisma/client";

export const useUsers = () =>
  useState<
    | Array<
        SerializeObject<
          User & {
            authMecs?: Array<{ id: string; mec: AuthMec }>;
          }
        >
      >
    | undefined
  >("users", () => undefined);

export const fetchUsers = async (options?: {
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

  const users = useUsers();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore forget why this ignor exists
  const newValue = await $dropFetch<User[]>(
    `/api/v1/admin/users?${query.toString()}`,
  );

  users.value = newValue;

  return newValue;
};
