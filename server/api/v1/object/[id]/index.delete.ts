export default defineEventHandler(async (h3) => {
  const id = getRouterParam(h3, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Invalid ID" });

  const userId = await h3.context.session.getUserId(h3);

  const result = await h3.context.objects.deleteWithPermission(id, userId);
  return { success: result };
});
