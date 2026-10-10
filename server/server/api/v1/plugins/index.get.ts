import pluginManager from "~/server/internal/plugins";
import { resolvePluginAuth } from "~/server/internal/plugins/auth";

const REDACTED_ERROR = "Plugin failed to load; see the server logs.";

export default defineEventHandler(async (h3) => {
  const auth = await resolvePluginAuth(h3);
  if (!auth.userId) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    });
  }

  // Error strings can contain absolute paths or expected checksums; only
  // expose them to administrators.
  const isAdmin = auth.userAcls?.includes("system:settings:update") ?? false;

  const plugins = pluginManager.listPlugins().map((plugin) => {
    let error: string | undefined;
    if (isAdmin) {
      error = plugin.error;
    } else if (plugin.error) {
      error = REDACTED_ERROR;
    }
    return {
      ...plugin,
      error,
    };
  });

  return { plugins };
});
