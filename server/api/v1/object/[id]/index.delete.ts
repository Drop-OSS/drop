import aclManager from "~/server/internal/acls";
import objectHandler from "~/server/internal/objects";

export default defineEventHandler(async (h3) => {
  const id = getRouterParam(h3, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Invalid ID" });

  const userId = await aclManager.getUserIdACL(h3, ["object:delete"]);

  const result = await objectHandler.deleteWithPermission(id, userId);
  return { success: result };
});
