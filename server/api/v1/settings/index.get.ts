import aclManager from "~/server/internal/acls";
import { applicationSettings } from "~/server/internal/config/application-configuration";

/**
 * Fetch system settings
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.getUserACL(h3, ["settings:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const showGamePanelTextDecoration = await applicationSettings.get(
    "showGamePanelTextDecoration",
  );

  return { showGamePanelTextDecoration };
});
