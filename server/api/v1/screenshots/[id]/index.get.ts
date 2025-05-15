// get a specific screenshot
import aclManager from "~/server/internal/acls";
import screenshotManager from "~/server/internal/screenshots";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["screenshots:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const screenshotId = getRouterParam(h3, "id");
  if (!screenshotId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing screenshot ID",
    });

  return await screenshotManager.get(screenshotId);
});
