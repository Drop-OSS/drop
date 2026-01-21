// import sessionHandler from "~/server/internal/session";
import authManager from "~/server/internal/auth";

defineRouteMeta({
  openAPI: {
    tags: ["Auth", "OIDC"],
    description: "OIDC logout back-channel",
    parameters: [],
  },
});

export default defineEventHandler(async (h3) => {
  // dont cache logout responses
  setHeader(h3, "Cache-Control", "no-store");

  const enabledAuthManagers = authManager.getAuthProviders();
  if (!enabledAuthManagers.OpenID)
    throw createError({
      statusCode: 400,
      message: "OIDC not enabled.",
    });

  const logout_token = (await readFormData(h3)).get("logout_token");
  if (typeof logout_token !== "string")
    throw createError({
      statusCode: 400,
      message: "Invalid OIDC logout notification.",
    });
  const okay = await enabledAuthManagers.OpenID.handleLogout(logout_token);
  if (!okay) {
    throw createError({
      statusCode: 400,
      message: "Invalid OIDC logout notification.",
    });
  }

  // const result = OIDCLogoutTokenV1(logout_token);

  //   const manager = enabledAuthManagers.OpenID;

  //   const query = getQuery(h3);

  return {
    success: true,
  };
});
