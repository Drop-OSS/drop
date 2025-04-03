const whitelistedPrefixes = [
  "/auth/signin",
  "/auth/register",
  "/api",
  "/setup",
];
const requireAdmin = ["/admin"];

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.server) return;
  const error = useError();
  if (error.value !== undefined) return;
  if (whitelistedPrefixes.findIndex((e) => to.fullPath.startsWith(e)) != -1)
    return;

  const user = useUser();
  if (user === undefined) {
    await updateUser();
  }
  if (!user.value) {
    return navigateTo({
      path: "/auth/signin",
      query: { redirect: to.fullPath },
    });
  }
  if (
    requireAdmin.findIndex((e) => to.fullPath.startsWith(e)) != -1 &&
    !user.value.admin
  ) {
    return navigateTo({ path: "/" });
  }
});
