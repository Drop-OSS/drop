import type { User } from "@prisma/client";

// undefined = haven't check
// null = check, no user
// {} = check, user

export const useUser = () => useState<User | undefined | null>(undefined);
export const updateUser = async () => {
  const headers = useRequestHeaders(["cookie"]);

  const user = useUser();
  if (user.value === null) return;

  // SSR calls have to be after uses
  user.value = await $fetch<User | null>("/api/v1/user", { headers });
};
