import { getQuery } from "h3";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import saveManager from "~/server/internal/saves";
import { assertGameExists } from "~/server/internal/saves/access";
import {
  assertCloudSaves,
  getGameId,
  getSlotIndex,
} from "~/server/internal/saves/http";

export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    assertCloudSaves(client);
    const user = await fetchUser();
    const gameId = getGameId(h3);
    const index = getSlotIndex(h3);
    await assertGameExists(gameId);

    const query = getQuery(h3);
    const cursor = typeof query.cursor === "string" ? query.cursor : null;
    const rawLimit =
      typeof query.limit === "string"
        ? Number.parseInt(query.limit, 10)
        : undefined;
    const limit =
      rawLimit !== undefined && Number.isSafeInteger(rawLimit)
        ? rawLimit
        : undefined;

    return saveManager.listVersions(user.id, gameId, index, {
      cursor,
      limit,
    });
  },
);
