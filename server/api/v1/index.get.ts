import { systemConfig } from "~/server/internal/config/sys-conf";

/**
 * Fetch instance information
 */
export default defineEventHandler(async (_h3) => {
  return {
    appName: "Drop",
    version: systemConfig.getDropVersion(),
    gitRef: `#${systemConfig.getGitRef()}`,
    external: systemConfig.getExternalUrl(),
  };
});
