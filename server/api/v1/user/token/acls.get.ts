import aclManager from "~/server/internal/acls";
import { userACLDescriptions } from "~/server/internal/acls/descriptions";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, []); // No ACLs only allows session authentication
  if (!userId) throw createError({ statusCode: 403 });

  return userACLDescriptions;
});
