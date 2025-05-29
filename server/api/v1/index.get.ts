import { systemConfig } from "~/server/internal/config/sys-conf";

export default defineEventHandler((_h3) => {
  return {
    appName: "Drop",
    version: systemConfig.getDropVersion(),
    ref: systemConfig.getGitRef(),
  };
});
