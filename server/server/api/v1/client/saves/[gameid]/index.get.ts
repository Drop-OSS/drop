import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import saveManager from "~/server/internal/saves";
import { assertGameExists } from "~/server/internal/saves/access";
import { assertCloudSaves, getGameId } from "~/server/internal/saves/http";

export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    assertCloudSaves(client);
    const user = await fetchUser();
    const gameId = getGameId(h3);
    await assertGameExists(gameId);
    return saveManager.listGameSlots(user.id, gameId);
  },
);
