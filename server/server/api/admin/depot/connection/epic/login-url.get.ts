import { createError, defineEventHandler } from "h3";
import aclManager from "~/server/internal/acls";
import { buildEpicAuthCodeLoginUrl } from "../../../../../utils/epic/client";

/**
 * Epic's sign-in page for copying an authorization code. Unlike GOG, Epic
 * web auth has no redirect-URI support (desktop launchers intercept a
 * custom scheme instead), so the code is fetched from the JSON page the
 * login flow ends on and pasted back into the connect form.
 */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, [])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  return { loginUrl: buildEpicAuthCodeLoginUrl() };
});
