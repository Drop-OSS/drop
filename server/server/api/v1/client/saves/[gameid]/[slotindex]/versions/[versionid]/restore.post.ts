import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { getProfile } from "~/server/internal/profiles/http";
import saveManager from "~/server/internal/saves";
import { assertGameExists } from "~/server/internal/saves/access";
import {
  assertCloudSaves,
  getBaseVersionId,
  getGameId,
  getSlotIndex,
  getVersionId,
  rethrowSaveError,
} from "~/server/internal/saves/http";

/**
 * Restore never rewrites history: it publishes a new version whose content is
 * the chosen version's, so every device converges on the new head.
 */
export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    assertCloudSaves(client);
    const user = await fetchUser();
    const profile = await getProfile(h3, user.id);
    const gameId = getGameId(h3);
    const index = getSlotIndex(h3);
    const versionId = getVersionId(h3);
    await assertGameExists(gameId);

    try {
      return await saveManager.restoreVersion(
        user.id,
        profile.id,
        gameId,
        index,
        versionId,
        getBaseVersionId(h3),
        client.id,
      );
    } catch (error) {
      rethrowSaveError(error);
    }
  },
);
