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

export const fetchUsers = async () => {
  const users = useUsers();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore forget why this ignor exists
  const newValue: User[] = await $dropFetch("/api/v1/admin/users");
  users.value = newValue;
  return newValue;
};
