// get a specific screenshot
import aclManager from "~/server/internal/acls";
import screenshotManager from "~/server/internal/screenshots";
import sanitize from "sanitize-filename";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["screenshots:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const unsafeId = getRouterParam(h3, "id");
  if (!unsafeId)
    throw createError({
      statusCode: 400,
      message: "Missing screenshot ID",
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
