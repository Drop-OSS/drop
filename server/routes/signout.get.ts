import sessionHandler from "../internal/session";

export default defineEventHandler(async (h3) => {
  await sessionHandler.clearSession(h3);

  return sendRedirect(h3, "/auth/signin");
});
