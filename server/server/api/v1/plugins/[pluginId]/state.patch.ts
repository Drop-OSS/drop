import { getRouterParam, readBody, createError } from "h3";
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

  const body = await readBody<{ enabled?: boolean }>(event);
  if (typeof body?.enabled !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: "Field 'enabled' (boolean) is required in request body",
    });
  }

  await pluginManager.togglePlugin(pluginId, body.enabled);
  const plugin = pluginManager.listPlugins().find((p) => p.id === pluginId);

  return {
    success: true,
    plugin,
  };
});
