import { createError, defineEventHandler, getQuery, sendRedirect } from "h3";
import aclManager from "~/server/internal/acls";
import { exchangeGogAuthorizationCode } from "../../../../../utils/gog";
import { consumeOAuthState } from "../../../../../utils/depot/oauth-state";
import { saveConnection } from "../../../../../utils/depot/connections";
import { prismaConnectionStore } from "../../../../../utils/depot/connection-store";

/**
 * GOG sign-in landing: redeems the one-shot code, stores the connection
 * (access + refresh + the account id GOG ships in the token response) and
 * sends the admin back to the discovery page.
 */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, [])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const query = getQuery(h3);
  const code = typeof query.code === "string" ? query.code : "";
  const state = typeof query.state === "string" ? query.state : "";
  if (!code || !consumeOAuthState(state, "gog"))
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid or expired GOG sign-in attempt - try again",
    });
  const base = (
    process.env.EXTERNAL_URL || `http://localhost:${process.env.PORT ?? 4000}`
  ).replace(/\/$/, "");
  const tokens = await exchangeGogAuthorizationCode(
    code,
    `${base}/api/admin/depot/connection/gog/callback`,
  );
  const accountId =
    typeof tokens.user_id === "string" && tokens.user_id
      ? tokens.user_id
      : undefined;
  if (!accountId)
    throw createError({
      statusCode: 502,
      statusMessage: "GOG did not return an account id with the token",
    });
  await saveConnection(prismaConnectionStore, {
    provider: "gog",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accountId,
  });
  return sendRedirect(h3, "/admin/depot", 302);
});
