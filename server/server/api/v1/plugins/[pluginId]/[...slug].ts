import { getRouterParam, createError } from "h3";
import pluginManager from "~/server/internal/plugins";

export default defineEventHandler(async (event) => {
  const pluginId = getRouterParam(event, "pluginId");
  if (!pluginId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing pluginId in route path",
    });
  }

  const slug = getRouterParam(event, "slug") ?? "";
  const subPath = `/${slug}`.replace(/\/+/g, "/");

  return await pluginManager.dispatch(pluginId, event.method, subPath, event);
});
