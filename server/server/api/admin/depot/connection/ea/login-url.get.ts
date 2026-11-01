import { createError, defineEventHandler } from "h3";
import aclManager from "~/server/internal/acls";
import { buildEaLoginUrl } from "../../../../../utils/ea/client";

/**
 * EA's launcher sign-in page. Login ends on the desktop launcher's
 * `code://` redirect, which the browser surfaces as an unopenable but
 * fully visible URL; copying its code is the web equivalent of a launcher
 * login and needs no stored password.
 */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, [])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  return { loginUrl: buildEaLoginUrl() };
});
