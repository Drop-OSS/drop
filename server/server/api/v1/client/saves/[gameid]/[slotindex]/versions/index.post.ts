import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { getProfile } from "~/server/internal/profiles/http";
import saveManager from "~/server/internal/saves";
import { assertGameExists } from "~/server/internal/saves/access";
import {
  assertCloudSaves,
  getBaseVersionId,
  getGameId,
  getIdempotencyKey,
  getOptionalIntHeader,
  getOptionalSha256,
  getSlotIndex,
  getVersionKind,
  rethrowSaveError,
} from "~/server/internal/saves/http";

export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    assertCloudSaves(client);
    const user = await fetchUser();
    const profile = await getProfile(h3, user.id);
    const gameId = getGameId(h3);
    const index = getSlotIndex(h3);
    await assertGameExists(gameId);

    try {
      return await saveManager.createVersion({
        gameId,
        userId: user.id,
        profileId: profile.id,
        index,
        clientId: client.id,
        clientName: client.name,
        clientPlatform: client.platform,
        stream: h3.node.req,
        baseVersionId: getBaseVersionId(h3),
        contentHash: getOptionalSha256(h3, "x-content-hash"),
        archiveSha256: getOptionalSha256(h3, "x-archive-sha256"),
        declaredSize: getOptionalIntHeader(h3, "content-length"),
        fileCount: getOptionalIntHeader(h3, "x-file-count"),
        manifestHash: getOptionalSha256(h3, "x-manifest-hash"),
        clientMutationId: getIdempotencyKey(h3),
        kind: getVersionKind(h3),
      });
    } catch (error) {
      rethrowSaveError(error);
    }
  },
);
