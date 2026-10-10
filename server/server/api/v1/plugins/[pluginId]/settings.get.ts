import { getRouterParam, createError } from "h3";
import aclManager from "~/server/internal/acls";
import pluginManager from "~/server/internal/plugins";

export default defineEventHandler(async (event) => {
  const allowed = await aclManager.allowSystemACL(event, []);
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: "Admin privileges required to manage plugins",
    });
  }

  const pluginId = getRouterParam(event, "pluginId");
  if (!pluginId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing pluginId parameter",
    });
  }

  const settings = await pluginManager.getPluginSettingsView(pluginId);
  if (!settings) {
    throw createError({
      statusCode: 404,
      statusMessage: `Plugin '${pluginId}' does not declare a settingsSchema`,
    });
  }

  return settings;
});
