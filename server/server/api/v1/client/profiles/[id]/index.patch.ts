import { getRouterParam, readBody } from "h3";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import profileManager from "~/server/internal/profiles";

/** Rename a player and/or change their colour. Deleting profiles is
 * deliberately absent in v1: they own play stats and save timelines, and
 * their history outlives a name change. */
export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();
  const id = getRouterParam(h3, "id");
  if (!id)
    throw createError({ statusCode: 400, statusMessage: "No ID in route" });
  const body = (await readBody(h3).catch(() => ({}))) as {
    name?: unknown;
    color?: unknown;
  };
  if (body.name !== undefined)
    return profileManager.update(user.id, id, body.name, body.color);
  if (body.color !== undefined)
    return profileManager.setColor(user.id, id, body.color);
  throw createError({
    statusCode: 400,
    statusMessage: "name or color required",
  });
});
