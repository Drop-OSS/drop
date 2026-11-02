import { createError, readBody } from "h3";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import saveManager from "~/server/internal/saves";
import { assertGameExists } from "~/server/internal/saves/access";
import { assertCloudSaves, getGameId } from "~/server/internal/saves/http";

export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    assertCloudSaves(client);
    const user = await fetchUser();
    const gameId = getGameId(h3);
    await assertGameExists(gameId);

    const body = (await readBody(h3).catch(() => ({}))) as {
      index?: unknown;
      label?: unknown;
    };
    const label = typeof body.label === "string" ? body.label : null;

    // No index means "give me the next slot", as before versioning.
    if (body.index === undefined || body.index === null)
      return saveManager.createNextSlot(user.id, gameId, label, client.id);

    const index = Number(body.index);
    if (!Number.isSafeInteger(index) || index < 0)
      throw createError({
        statusCode: 400,
        statusMessage: "index must be a non-negative integer",
      });

    return saveManager.createSlot(user.id, gameId, index, label, client.id);
  },
);
