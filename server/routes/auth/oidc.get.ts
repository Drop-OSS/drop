import authManager from "~/server/internal/auth";

defineRouteMeta({
  openAPI: {
    tags: ["Auth"],
    description: "OIDC Signin redirect",
    parameters: [],
  },
});

export default defineEventHandler((h3) => {
  const redirect = getQuery(h3).redirect?.toString();

  const enabledAuthManagers = authManager.getAuthProviders();
  if (!enabledAuthManagers.OpenID)
    return sendRedirect(
      h3,
      `/auth/signin${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`,
    );

  const manager = enabledAuthManagers.OpenID;
  const { redirectUrl } = manager.generateAuthSession({ redirect });

  return sendRedirect(h3, redirectUrl);
});
