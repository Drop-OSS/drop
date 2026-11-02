import { getRouterParam, readBody } from "h3";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import profileManager from "~/server/internal/profiles";

/** Rename a player. Deleting profiles is deliberately absent in v1: they own
 * play stats and save timelines, and their history outlives a name change. */
export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();
  const id = getRouterParam(h3, "id");
  if (!id)
    throw createError({ statusCode: 400, statusMessage: "No ID in route" });
  const body = (await readBody(h3).catch(() => ({}))) as { name?: unknown };
  return profileManager.rename(user.id, id, body.name);
});
