import { AuthMec } from "~/prisma/client";
import aclManager from "~/server/internal/acls";
import { enabledAuthManagers } from "~/server/plugins/04.auth-init";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["auth:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const authData = {
    [AuthMec.Simple]: enabledAuthManagers.Simple,
    [AuthMec.OpenID]:
      enabledAuthManagers.OpenID &&
      enabledAuthManagers.OpenID.generateConfiguration(),
  };

  return authData;
});
