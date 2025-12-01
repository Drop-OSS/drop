import aclManager from "~/server/internal/acls";
import serviceManager from "~/server/internal/services";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["maintenance:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const healthcheck = serviceManager.healthchecks();
  return healthcheck;
});
