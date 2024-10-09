const whitelistedPrefixes = ["/signin", "/register", "/api"];

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.server) return;
  if (whitelistedPrefixes.findIndex((e) => to.fullPath.startsWith(e)) != -1)
    return;

  const user = useUser();
  if (user === undefined) {
    await updateUser();
  }
  if (!user.value) {
    return navigateTo({ path: "/signin", query: { redirect: to.fullPath } });
  }
});
