import { AuthMec } from "@prisma/client";
import aclManager from "~/server/internal/acls";
import { applicationSettings } from "~/server/internal/config/application-configuration";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["auth:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const enabledMechanisms: AuthMec[] = await applicationSettings.get(
    "enabledAuthencationMechanisms"
  );

  return enabledMechanisms;
});
