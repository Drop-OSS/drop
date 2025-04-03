import { ClientCapabilities } from "@prisma/client";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import { applicationSettings } from "~/server/internal/config/application-configuration";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    if (!client.capabilities.includes(ClientCapabilities.CloudSaves))
      throw createError({
        statusCode: 403,
        statusMessage: "Capability not allowed.",
      });

    const slotLimit = await applicationSettings.get("saveSlotCountLimit");
    const sizeLimit = await applicationSettings.get("saveSlotSizeLimit");
    const history = await applicationSettings.get("saveSlotHistoryLimit");
    return { slotLimit, sizeLimit, history };
  }
);
