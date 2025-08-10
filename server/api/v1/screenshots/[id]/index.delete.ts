import aclManager from "~/server/internal/acls";
import screenshotManager from "~/server/internal/screenshots";
import sanitize from "sanitize-filename";

/**
 * Delete screenshot by ID
 * @param id Screenshot ID
 */
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["screenshots:delete"]);
  if (!userId) throw createError({ statusCode: 403 });

  const unsafeId = getRouterParam(h3, "id");
  if (!unsafeId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing screenshot ID",
    });

  const screenshotId = sanitize(unsafeId);
  const result = await screenshotManager.get(screenshotId);
  if (!result)
    throw createError({
      statusCode: 404,
    });
  if (result.userId !== userId)
    throw createError({
      statusCode: 404,
    });

  await screenshotManager.delete(screenshotId);
});
