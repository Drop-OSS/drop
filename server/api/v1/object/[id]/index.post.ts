export default defineEventHandler(async (h3) => {
  const id = getRouterParam(h3, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Invalid ID" });

  const body = await readRawBody(h3, "binary");
  if (!body)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid upload",
    });

  const userId = await h3.context.session.getUserId(h3);
  const buffer = Buffer.from(body);

  const result = await h3.context.objects.writeWithPermissions(
    id,
    async () => buffer,
    userId
  );
  return { success: result };
});
