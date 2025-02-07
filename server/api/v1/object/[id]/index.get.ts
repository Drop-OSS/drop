import aclManager from "~/server/internal/acls";
import objectHandler from "~/server/internal/objects";

export default defineEventHandler(async (h3) => {
  const id = getRouterParam(h3, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Invalid ID" });

  const userId = await aclManager.getUserIdACL(h3, ["object:read"]);

  const object = await objectHandler.fetchWithPermissions(id, userId);
  if (!object)
    throw createError({ statusCode: 404, statusMessage: "Object not found" });

  setHeader(h3, "Content-Type", object.mime);
  return object.data;
});
