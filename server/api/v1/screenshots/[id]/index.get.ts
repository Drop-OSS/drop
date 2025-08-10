// get a specific screenshot
import aclManager from "~/server/internal/acls";
import screenshotManager from "~/server/internal/screenshots";
import sanitize from "sanitize-filename";

/**
 * Fetch screenshot by ID. Use `/api/v1/object/:id` to actually fetch screenshot image data.
 * @param id Screenshot ID
 */
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["screenshots:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const unsafeId = getRouterParam(h3, "id");
  if (!unsafeId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing screenshot ID",
    });

  const result = await screenshotManager.get(sanitize(unsafeId));
  if (!result)
    throw createError({
      statusCode: 404,
    });
  if (result.userId !== userId)
    throw createError({
      statusCode: 404,
    });
  return result;
});
