// get all user screenshots
import aclManager from "~/server/internal/acls";
import screenshotManager from "~/server/internal/screenshots";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["screenshots:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const results = await screenshotManager.getUserAll(userId);
  return results;
});
