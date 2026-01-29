import aclManager from "~/server/internal/acls";
import { applicationSettings } from "~/server/internal/config/application-configuration";
import type { Settings } from "~/server/internal/utils/types";

export default defineEventHandler(async (h3): Promise<Settings> => {
  const allowed = await aclManager.getUserACL(h3, ["settings:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  return applicationSettings.getSettings();
});
