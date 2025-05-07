import sessionHandler from "~/server/internal/session";
import { enabledAuthManagers } from "~/server/plugins/04.auth-init";

export default defineEventHandler(async (h3) => {
  if (!enabledAuthManagers.oidc) return sendRedirect(h3, "/auth/signin");

  const manager = enabledAuthManagers.oidc;

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

  const user = await manager.authorize(code, state);

  if (typeof user === "string")
    throw createError({
      statusCode: 403,
      statusMessage: `Failed to sign in: "${user}". Please try again.`,
    });


  await sessionHandler.signin(h3, user.id, true);

  return sendRedirect(h3, "/");
});
