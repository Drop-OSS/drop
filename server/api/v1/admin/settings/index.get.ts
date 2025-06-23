import aclManager from "~/server/internal/acls";
import { applicationSettings } from "~/server/internal/config/application-configuration";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.getUserACL(h3, ["settings:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const showTitleDescriptionOnGamePanel = await applicationSettings.get(
    "showTitleDescriptionOnGamePanel",
  );

  return { showTitleDescriptionOnGamePanel };
});
