import aclManager from "~/server/internal/acls";
import objectHandler from "~/server/internal/objects";
import sanitize from "sanitize-filename";

// this request method is purely used by the browser to check if etag values are still valid
export default defineEventHandler(async (h3) => {
  const unsafeId = getRouterParam(h3, "id");
  if (!unsafeId)
    throw createError({ statusCode: 400, message: "Invalid ID" });

  const userId = await aclManager.getUserIdACL(h3, ["object:read"]);

  const id = sanitize(unsafeId);
  const object = await objectHandler.fetchWithPermissions(id, userId);
  if (!object)
    throw createError({ statusCode: 404, message: "Object not found" });

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
