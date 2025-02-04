import aclManager from "~/server/internal/acls";

export default defineEventHandler(async (h3) => {
  const user = await aclManager.getUserACL(h3, ["read"]);
  return user ?? null; // Need to specifically return null
});
