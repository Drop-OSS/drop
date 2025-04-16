import { ClientCapabilities } from "@prisma/client";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import prisma from "~/server/internal/db/database";

export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    if (!client.capabilities.includes(ClientCapabilities.CloudSaves))
      throw createError({
        statusCode: 403,
        statusMessage: "Capability not allowed.",
      });
    const user = await fetchUser();

    const saves = await prisma.saveSlot.findMany({
      where: {
        userId: user.id,
      },
    });

    return saves;
  },
);
