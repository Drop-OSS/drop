import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import saveManager from "~/server/internal/saves";
import { assertGameExists } from "~/server/internal/saves/access";
import {
  assertCloudSaves,
  getGameId,
  getQueryOptional,
  getQueryOptionalSha256,
  getSlotIndex,
} from "~/server/internal/saves/http";

/**
 * "What should I do with this save?" The client reports the version it last
 * synced and a hash of what it has on disk; the answer is one of
 * noop | push | pull | converged | conflict. Never decided by clocks.
 */
export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    assertCloudSaves(client);
    const user = await fetchUser();
    const gameId = getGameId(h3);
    const index = getSlotIndex(h3);
    await assertGameExists(gameId);

    return saveManager.syncState(user.id, gameId, index, {
      baseVersionId: getQueryOptional(h3, "baseVersionId"),
      localContentHash: getQueryOptionalSha256(h3, "localContentHash"),
    });
  },
);
