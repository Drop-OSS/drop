const whitelistedPrefixes = ["/auth", "/api", "/setup"];
const requireAdmin = ["/admin"];

export default defineNuxtRouteMiddleware(async (to, _from) => {
  const error = useError();
  if (error.value !== undefined) return;
  if (whitelistedPrefixes.some((e) => to.fullPath.startsWith(e))) return;

  const user = useUser();
  if (user.value === undefined) {
    await updateUser();
  }
  if (!user.value) {
    return navigateTo({
      path: "/auth/signin",
      query: { redirect: to.fullPath },
    });
  }
  if (
    requireAdmin.some((e) => to.fullPath.startsWith(e)) &&
    !user.value.admin
  ) {
    return navigateTo({ path: "/" });
  }
});
