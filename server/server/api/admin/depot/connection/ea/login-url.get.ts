import { createError, defineEventHandler } from "h3";
import aclManager from "~/server/internal/acls";
import { buildEaLoginUrl } from "../../../../../utils/ea/client";

/**
 * EA's own sign-in page, only when the deployment configures a
 * confidential EA OAuth client (EA grants no public ones - a public
 * client id is rejected as "unknown client"). The response's loginUrl is
 * null otherwise, and the UI explains the token-paste path instead.
 */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, [])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  return { loginUrl: buildEaLoginUrl() };
});
