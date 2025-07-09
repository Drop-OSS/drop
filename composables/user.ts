import type { UserModel } from "~/prisma/client/models";

// undefined = haven't check
// null = check, no user
// {} = check, user

export const useUser = () => useState<UserModel | undefined | null>(undefined);
export const updateUser = async () => {
  const user = useUser();
  if (user.value === null) return;

  user.value = await $dropFetch<UserModel | null>("/api/v1/user");
};
