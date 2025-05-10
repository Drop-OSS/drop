import { enabledAuthManagers } from "~/server/plugins/04.auth-init";

defineRouteMeta({
  openAPI: {
    tags: ["Auth"],
    description: "OIDC Signin redirect",
    parameters: [],
  },
});

export default defineEventHandler((h3) => {
  if (!enabledAuthManagers.OpenID) return sendRedirect(h3, "/auth/signin");

  const manager = enabledAuthManagers.OpenID;
  const { redirectUrl } = manager.generateAuthSession();

  return sendRedirect(h3, redirectUrl);
});
