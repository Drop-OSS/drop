import { AuthMec } from "~/prisma/client/enums";
import aclManager from "~/server/internal/acls";
import authManager from "~/server/internal/auth";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["auth:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const enabledAuthManagers = authManager.getAuthProviders();

  const authData = {
    [AuthMec.Simple]: enabledAuthManagers.Simple,
    [AuthMec.OpenID]:
      enabledAuthManagers.OpenID &&
      enabledAuthManagers.OpenID.generateConfiguration(),
  };

  return authData;
});
