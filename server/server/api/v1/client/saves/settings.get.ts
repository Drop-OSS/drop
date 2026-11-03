import { ClientCapabilities } from "~/prisma/client/enums";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { applicationSettings } from "~/server/internal/config/application-configuration";

export default defineClientEventHandler(async (_h3, { fetchClient }) => {
  const client = await fetchClient();
  if (!client.capabilities.includes(ClientCapabilities.CloudSaves))
    throw createError({
      statusCode: 403,
      statusMessage: "Capability not allowed.",
    });

  const slotLimit = await applicationSettings.get("saveSlotCountLimit");
  const sizeLimit = await applicationSettings.get("saveSlotSizeLimit");
  const history = await applicationSettings.get("saveSlotHistoryLimit");
  const userStorageLimit = await applicationSettings.get(
    "saveUserStorageLimit",
  );
  return {
    slotLimit,
    sizeLimit,
    history,
    // MB across every game and profile of this account; 0 = unlimited. A push
    // over it is refused with 400, so a client may want to prune before retrying.
    userStorageLimit,
    // Versioned saves are always on in this release; clients still gate on
    // `features.versionedSaves` so older servers stay usable.
    features: {
      versionedSaves: true,
      conflictResolution: true,
      restore: true,
      pinning: true,
      storageQuota: userStorageLimit > 0,
    },
    apiVersion: 2,
  };
});
