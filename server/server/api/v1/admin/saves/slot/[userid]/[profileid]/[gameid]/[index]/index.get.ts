import { defineEventHandler } from "h3";
import { applicationSettings } from "~/server/internal/config/application-configuration";
import saveManager from "~/server/internal/saves";
import { allowSaveAdmin, getSlotKey } from "~/server/internal/saves/admin";

/**
 * One slot's timeline as its owner would see it, plus the owner's total
 * usage: the admin page opens a slot to decide which version to keep.
 */
export default defineEventHandler(async (event) => {
  await allowSaveAdmin(event);
  const { userId, profileId, gameId, index } = getSlotKey(event);

  const [slot, versions, usedBytes, quotaMb] = await Promise.all([
    saveManager.getSlot(userId, profileId, gameId, index),
    saveManager.listVersions(userId, profileId, gameId, index, { limit: 100 }),
    saveManager.userStorageUsedBytes(userId),
    applicationSettings.get("saveUserStorageLimit"),
  ]);

  return { slot, versions, usedBytes, quotaMb };
});
