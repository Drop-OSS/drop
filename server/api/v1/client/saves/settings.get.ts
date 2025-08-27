import { ClientCapabilities } from "~/prisma/client/enums";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { applicationSettings } from "~/server/internal/config/application-configuration";

export default defineClientEventHandler(async (_h3, { fetchClient }) => {
  const client = await fetchClient();
  if (!client.capabilities.includes(ClientCapabilities.CloudSaves))
    throw createError({
      statusCode: 403,
      message: "Capability not allowed.",
    });

  const slotLimit = await applicationSettings.get("saveSlotCountLimit");
  const sizeLimit = await applicationSettings.get("saveSlotSizeLimit");
  const history = await applicationSettings.get("saveSlotHistoryLimit");
  return { slotLimit, sizeLimit, history };
});
