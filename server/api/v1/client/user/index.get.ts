import { defineClientEventHandler } from "~/server/internal/clients/event-handler";

export default defineClientEventHandler(async (h3, { fetchUser }) => {
  const user = await fetchUser();

  return user;
});
