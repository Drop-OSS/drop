import authManager from "~/server/internal/auth";

/**
 * Fetch public authentication provider mechanisms
 */
export default defineEventHandler(() => {
  return authManager.getEnabledAuthProviders();
});
