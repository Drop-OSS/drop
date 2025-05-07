import { enabledAuthManagers } from "~/server/plugins/04.auth-init";

export default defineEventHandler((h3) => {
  if (!enabledAuthManagers.oidc) return sendRedirect(h3, "/auth/signin");

  const manager = enabledAuthManagers.oidc;
  const { redirectUrl } = manager.generateAuthSession();

  return sendRedirect(h3, redirectUrl);
});
