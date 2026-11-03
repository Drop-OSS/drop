import { defineEventHandler, setHeader } from "h3";
import saveManager from "~/server/internal/saves";
import {
  allowSaveAdmin,
  requireVersionSlot,
} from "~/server/internal/saves/admin";

/**
 * One archived save as its owner would download it, so an admin can open a
 * suspicious version instead of guessing from its hash. The bytes are read
 * with the owner's own object ACL, which is also what keeps a missing object
 * a 404 here rather than a server error.
 */
export default defineEventHandler(async (event) => {
  await allowSaveAdmin(event);
  const { userId, profileId, gameId, index, versionId } =
    await requireVersionSlot(event);

  const { version, data, mime } = await saveManager.downloadVersion(
    userId,
    profileId,
    gameId,
    index,
    versionId,
  );

  setHeader(event, "Content-Type", mime || "application/zstd");
  setHeader(
    event,
    "Content-Disposition",
    `attachment; filename="save-${version.gameId}-slot${version.slotIndex}-${version.id}.tar.zst"`,
  );
  setHeader(event, "X-Save-Version-Id", version.id);
  setHeader(event, "X-Save-Content-Hash", version.contentHash);
  setHeader(event, "X-Save-Archive-Sha256", version.archiveSha256);
  setHeader(event, "ETag", `"${version.id}"`);
  return data;
});
