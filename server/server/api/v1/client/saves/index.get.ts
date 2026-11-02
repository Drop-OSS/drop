import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import saveManager from "~/server/internal/saves";
import { assertCloudSaves } from "~/server/internal/saves/http";

export default defineClientEventHandler(
  async (_h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    assertCloudSaves(client);
    const user = await fetchUser();
    return saveManager.listSlots(user.id);
  },
);
