import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { getProfile } from "~/server/internal/profiles/http";
import saveManager from "~/server/internal/saves";
import { assertGameExists } from "~/server/internal/saves/access";
import {
  assertCloudSaves,
  getGameId,
  getSlotIndex,
} from "~/server/internal/saves/http";

/**
 * Legacy push endpoint. New clients upload through /versions with an
 * If-Match base version so concurrent edits surface as conflicts.
 */
export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    assertCloudSaves(client);
    const user = await fetchUser();
    const profile = await getProfile(h3, user.id);
    const gameId = getGameId(h3);
    const index = getSlotIndex(h3);
    await assertGameExists(gameId);

    await saveManager.pushSave(gameId, user.id, profile.id, index, h3.node.req, client.id);
    return {};
  },
);
