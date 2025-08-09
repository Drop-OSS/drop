import aclManager from "~/server/internal/acls";

/**
 * Check if we are an admin/system
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, []);
  if (!allowed) return false;
  return true;
});
