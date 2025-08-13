import aclManager from "~/server/internal/acls";
import objectHandler from "~/server/internal/objects";
import sanitize from "sanitize-filename";

/**
 * Delete object
 * @param id Object ID
 */
export default defineEventHandler(async (h3) => {
  const unsafeId = getRouterParam(h3, "id");
  if (!unsafeId)
    throw createError({ statusCode: 400, statusMessage: "Invalid ID" });

  const userId = await aclManager.getUserIdACL(h3, ["object:delete"]);

  const id = sanitize(unsafeId);
  const result = await objectHandler.deleteWithPermission(id, userId);
  return { success: result };
});
