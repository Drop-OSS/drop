import aclManager from "~/server/internal/acls";
import { systemACLDescriptions } from "~/server/internal/acls/descriptions";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, []); // No ACLs only allows session authentication
  if (!allowed) throw createError({ statusCode: 403 });

  return systemACLDescriptions;
});
