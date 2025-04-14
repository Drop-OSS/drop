import aclManager from "~/server/internal/acls";
import objectHandler from "~/server/internal/objects";

// this request method is purely used by the browser to check if etag values are still valid
export default defineEventHandler(async (h3) => {
  const id = getRouterParam(h3, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Invalid ID" });

  const userId = await aclManager.getUserIdACL(h3, ["object:read"]);

  const object = await objectHandler.fetchWithPermissions(id, userId);
  if (!object)
    throw createError({ statusCode: 404, statusMessage: "Object not found" });

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag
  const etagRequestValue = h3.headers.get("If-None-Match");
  const etagActualValue = await objectHandler.fetchHash(id);
  if (etagRequestValue !== null && etagActualValue === etagRequestValue) {
    // would compare if etag is valid, but objects should never change
    setResponseStatus(h3, 304);
    return null;
  }

  return null;
});
