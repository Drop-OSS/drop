import aclManager from "~/server/internal/acls";
import imageHandler from "~/server/internal/metadata/image";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:image:import"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const images = await imageHandler.searchImages("space engineers");

  return images;
});
