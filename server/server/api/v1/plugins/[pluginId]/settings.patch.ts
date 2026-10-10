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

  const body = await readBody<{ values?: unknown }>(event);
  if (
    !body ||
    typeof body.values !== "object" ||
    body.values === null ||
    Array.isArray(body.values)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Field 'values' (object) is required in request body",
    });
  }

  const settings = await pluginManager.setPluginSettings(pluginId, body.values);
  return { success: true, ...settings };
});
