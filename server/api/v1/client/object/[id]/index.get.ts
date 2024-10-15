import { defineClientEventHandler } from "~/server/internal/clients/event-handler";

export default defineClientEventHandler(async (h3, utils) => {
  const id = getRouterParam(h3, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Invalid ID" });

  const user = await utils.fetchUser();

  const object = await h3.context.objects.fetchWithPermissions(id, user.id);
  if (!object)
    throw createError({ statusCode: 404, statusMessage: "Object not found" });

  setHeader(h3, "Content-Type", object.mime);
  return object.data;
});
