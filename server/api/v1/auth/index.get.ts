import authManager from "~/server/internal/auth";

export default defineEventHandler(() => {
  return authManager.getEnabledAuthProviders();
});
