import aclManager from "~/server/internal/acls";
import metadataHandler from "~/server/internal/metadata";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "import:game:read",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const query = getQuery(h3);
  const search = query.q?.toString();
  if (!search)
    throw createError({ statusCode: 400, statusMessage: "Invalid search" });

  const results = await metadataHandler.search(search);

  if (results.length == 0)
    throw createError({
      statusCode: 500,
      statusMessage: "No metadata provider returned search results.",
    });

  return results;
});
