import sessionHandler from "~/server/internal/session";
import authManager from "~/server/internal/auth";
import type { Session } from "~/server/internal/session/types";

defineRouteMeta({
  openAPI: {
    tags: ["Auth", "OIDC"],
    description: "OIDC Signin callback",
    parameters: [],
  },
});

export default defineEventHandler(async (h3) => {
  // dont cache login responses
  setHeader(h3, "Cache-Control", "no-store");

  const enabledAuthManagers = authManager.getAuthProviders();
  if (!enabledAuthManagers.OpenID) return sendRedirect(h3, "/auth/signin");

  const manager = enabledAuthManagers.OpenID;

  const query = getQuery(h3);
  const code = query.code?.toString();
  if (!code)
    throw createError({
      statusCode: 400,
      statusMessage: "No code in query params.",
    });

  const state = query.state?.toString();
  if (!state)
    throw createError({
      statusCode: 400,
      statusMessage: "No state in query params.",
    });

  const result = await manager.authorize(code, state);

  if (typeof result === "string")
    throw createError({
      statusCode: 403,
      statusMessage: `Failed to sign in: "${result}". Please try again.`,
    });

  // Attach OIDC session data
  const oidcData: Session["oidc"] = {
    iss: result.claims.iss,
  };
  if (result.claims.sub) oidcData.sub = result.claims.sub;
  if (result.claims.sid) oidcData.sid = result.claims.sid;

  const sessionResult = await sessionHandler.signin(h3, result.user.id, {
    rememberMe: true,
    oidc: oidcData,
  });
  if (sessionResult == "fail")
    throw createError({ statusCode: 500, message: "Failed to set session" });
  else if (sessionResult == "2fa") {
    return sendRedirect(
      h3,
      `/auth/mfa?redirect=${result.options.redirect ? encodeURIComponent(result.options.redirect) : "/"}`,
    );
  }

  if (result.options.redirect) {
    return sendRedirect(h3, result.options.redirect);
  }

  return sendRedirect(h3, "/");
});
