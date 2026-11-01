import { createError, defineEventHandler } from "h3";
import aclManager from "~/server/internal/acls";
import { buildGogAuthorizeUrl } from "../../../../../utils/gog";

/**
 * GOG's launcher-client sign-in page. GOG only accepts its own embed
 * redirect for the public client (a server-side callback lands on GOG's
 * "invalid client" page), so sign-in ends on embed.gog.com/auth?code=...
 * and the user copies that code back - the gogrepo flow.
 */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, [])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  return { authorizeUrl: buildGogAuthorizeUrl() };
});
