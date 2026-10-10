import aclManager from "~/server/internal/acls";
import pluginManager from "~/server/internal/plugins";

export default defineEventHandler(async (event) => {
  const allowed = await aclManager.allowSystemACL(event, []);
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: "Admin privileges required to reload plugins",
    });
  }

  await pluginManager.reloadPlugins();
  return {
    success: true,
    plugins: pluginManager.listPlugins(),
  };
});
