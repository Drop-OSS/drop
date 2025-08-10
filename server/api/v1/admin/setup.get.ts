import aclManager from "~/server/internal/acls";

/**
 * Check if we are a setup token
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["setup"]);
  if (!allowed) return false;
  return true;
});
