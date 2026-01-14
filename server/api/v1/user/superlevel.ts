import aclManager from "~/server/internal/acls";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.allowUserSuperlevel(h3);
  return userId !== undefined;
});
