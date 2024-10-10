export default defineEventHandler(async (h3) => {
  const user = await h3.context.session.getUser(h3);
  if (!user)
    throw createError({ statusCode: 403, statusMessage: "Not authenticated" });
  return { admin: user.admin };
});
