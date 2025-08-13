import { defineClientEventHandler } from "~/server/internal/clients/event-handler";

/**
 * Fetch user data for this client
 */
export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();

  return user;
});
