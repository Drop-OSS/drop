import { createError, defineEventHandler } from "h3";
import aclManager from "~/server/internal/acls";
import { buildGogAuthorizeUrl } from "../../../../../utils/gog";
import { createOAuthState } from "../../../../../utils/depot/oauth-state";

/**
 * Starts the Heroic-style GOG sign-in: hands the browser a gog.com login
 * URL whose callback lands back on this server, where the code is
 * exchanged with the public Galaxy client.
 */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, [])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const base = (
    process.env.EXTERNAL_URL || `http://localhost:${process.env.PORT ?? 4000}`
  ).replace(/\/$/, "");
  const redirectUri = `${base}/api/admin/depot/connection/gog/callback`;
  return {
    authorizeUrl: buildGogAuthorizeUrl(redirectUri, createOAuthState("gog")),
  };
});
