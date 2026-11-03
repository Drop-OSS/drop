import { defineEventHandler } from "h3";
import saveManager from "~/server/internal/saves";
import {
  allowSaveAdmin,
  requireVersionSlot,
} from "~/server/internal/saves/admin";

/**
 * Drop one version out of a slot's history. The service refuses to remove a
 * slot's head (400), so an admin deletes a stale version or restores first -
 * the timeline can never be emptied from under a device.
 */
export default defineEventHandler(async (event) => {
  await allowSaveAdmin(event);
  const { userId, profileId, gameId, index, versionId } =
    await requireVersionSlot(event);

  await saveManager.deleteVersion(userId, profileId, gameId, index, versionId);
  return { deleted: true };
});
