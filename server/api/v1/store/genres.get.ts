import { Genre } from "~/prisma/client";
import aclManager from "~/server/internal/acls";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const genres = Object.values(Genre);
  return genres;
});
