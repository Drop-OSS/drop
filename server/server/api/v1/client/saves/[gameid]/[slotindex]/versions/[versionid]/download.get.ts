import { setHeader } from "h3";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import saveManager from "~/server/internal/saves";
import { assertGameExists } from "~/server/internal/saves/access";
import {
  assertCloudSaves,
  getGameId,
  getSlotIndex,
  getVersionId,
} from "~/server/internal/saves/http";

export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    assertCloudSaves(client);
    const user = await fetchUser();
    const gameId = getGameId(h3);
    const index = getSlotIndex(h3);
    const versionId = getVersionId(h3);
    await assertGameExists(gameId);

    const { version, data, mime } = await saveManager.downloadVersion(
      user.id,
      gameId,
      index,
      versionId,
    );

    setHeader(h3, "Content-Type", mime || "application/zstd");
    setHeader(h3, "X-Save-Version-Id", version.id);
    setHeader(h3, "X-Save-Content-Hash", version.contentHash);
    setHeader(h3, "X-Save-Archive-Sha256", version.archiveSha256);
    setHeader(h3, "ETag", `"${version.id}"`);
    return data;
  },
);
