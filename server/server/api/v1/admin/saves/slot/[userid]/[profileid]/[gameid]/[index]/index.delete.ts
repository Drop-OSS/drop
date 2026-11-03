import { defineEventHandler } from "h3";
import saveManager from "~/server/internal/saves";
import { allowSaveAdmin, getSlotKey } from "~/server/internal/saves/admin";

/**
 * Drop one slot and its whole history. Objects are reference-counted, so a
 * version sharing bytes with another slot leaves those bytes behind; the rest
 * is gone. Deliberately per slot: there is no bulk purge to fat-finger.
 */
export default defineEventHandler(async (event) => {
  await allowSaveAdmin(event);
  const { userId, profileId, gameId, index } = getSlotKey(event);

  await saveManager.deleteSlot(userId, profileId, gameId, index);
  return { deleted: true };
});
