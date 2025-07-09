import type { SerializeObject } from "nitropack";
import type { UserModel } from "~/prisma/client/models";
import type { AuthMec } from "~/prisma/client/enums";

export const useUsers = () =>
  useState<
    | Array<
        SerializeObject<
          UserModel & {
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
