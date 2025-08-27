import aclManager from "~/server/internal/acls";
import objectHandler from "~/server/internal/objects";
import sanitize from "sanitize-filename";

export default defineEventHandler(async (h3) => {
  const unsafeId = getRouterParam(h3, "id");
  if (!unsafeId)
    throw createError({ statusCode: 400, message: "Invalid ID" });

  const body = await readRawBody(h3, "binary");
  if (!body)
    throw createError({
      statusCode: 400,
      message: "Invalid upload",
    });

  const userId = await aclManager.getUserIdACL(h3, ["object:update"]);
  const buffer = Buffer.from(body);

  const id = sanitize(unsafeId);
  const result = await objectHandler.writeWithPermissions(
    id,
    async () => buffer,
    userId,
  );
  return { success: result };
});
