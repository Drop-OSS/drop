import authManager from "~/server/internal/auth";

export default defineEventHandler(() => {
  return {
    enabledAuthProviders: authManager.getEnabledAuthProviders(),
    oidcProviderName: process.env.OIDC_PROVIDER_NAME,
  };
});
