import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import profileManager from "~/server/internal/profiles";

/** The signed-in user's players: default first, then by creation. */
export default defineClientEventHandler(async (_h3, { fetchUser }) => {
  const user = await fetchUser();
  return profileManager.list(user.id);
});
