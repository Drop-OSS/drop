import pluginManager from "~/server/internal/plugins";
import { resolvePluginAuth } from "~/server/internal/plugins/auth";

export default defineEventHandler(async (h3) => {
  const auth = await resolvePluginAuth(h3);
  if (!auth.userId) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    });
  }

  const isAdmin = auth.userAcls?.includes("system:settings:update") ?? false;
  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Admin privileges required to check for plugin updates",
    });
  }

  const updates = await pluginManager.checkForUpdates();
  return { updates };
});
