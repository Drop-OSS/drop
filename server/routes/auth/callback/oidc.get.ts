import sessionHandler from "~/server/internal/session";
import { enabledAuthManagers } from "~/server/plugins/04.auth-init";

defineRouteMeta({
  openAPI: {
    tags: ["Auth"],
    description: "OIDC Signin callback",
    parameters: [],
  },
});

export default defineEventHandler(async (h3) => {
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

  await sessionHandler.signin(h3, result.user.id, true);

  if (result.options.redirect) {
    return sendRedirect(h3, result.options.redirect);
  }

  return sendRedirect(h3, "/");
});
