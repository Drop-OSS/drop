import { readBody } from "h3";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import profileManager from "~/server/internal/profiles";

/** Add a player to the account. The first profile ever created is default. */
export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();
  const body = (await readBody(h3).catch(() => ({}))) as {
    name?: unknown;
    color?: unknown;
  };
  return profileManager.create(user.id, body.name, body.color);
});
