import { applicationSettings } from "~/server/internal/config/application-configuration";
import { systemConfig } from "~/server/internal/config/sys-conf";

export default defineEventHandler(async (_h3) => {
  return {
    appName: "Drop",
    version: systemConfig.getDropVersion(),
    gitRef: `#${systemConfig.getGitRef()}`,
    external: systemConfig.getExternalUrl(),
    serverName: await applicationSettings.get("serverName"),
    mLogoObjectId: await applicationSettings.get("mLogoObjectId"),
  };
});
