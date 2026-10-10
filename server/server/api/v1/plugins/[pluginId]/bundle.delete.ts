import { getRouterParam } from "h3";
import aclManager from "~/server/internal/acls";
import pluginManager from "~/server/internal/plugins";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, []);
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: "Admin privileges required to remove plugins",
    });
  }

  const pluginId = getRouterParam(h3, "pluginId");
  if (!pluginId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing pluginId parameter",
    });
  }

  try {
    await pluginManager.removeBundle(pluginId);
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: String(err) });
  }

  return { success: true, plugins: pluginManager.listPlugins() };
});
