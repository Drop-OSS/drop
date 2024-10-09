export default defineEventHandler(async (h3) => {
  const user = await h3.context.session.getUser(h3);
  return user ?? null; // Need to specifically return null
});
