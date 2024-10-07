export default defineEventHandler(async (h3) => {
  await h3.context.session.clearSession(h3);

  return sendRedirect(h3, "/signin");
});
