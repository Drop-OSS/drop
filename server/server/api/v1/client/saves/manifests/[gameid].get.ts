import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import saveManager from "~/server/internal/saves";
import { assertGameExists } from "~/server/internal/saves/access";
import { assertCloudSaves, getGameId } from "~/server/internal/saves/http";

/**
 * The Ludusavi manifest entry the client uses to locate this game's save files
 * and build the archive. Read-only; the client resolves placeholders locally
 * for its platform and Proton prefix.
 */
export default defineClientEventHandler(
  async (h3, { fetchClient, fetchUser }) => {
    const client = await fetchClient();
    assertCloudSaves(client);
    // The manifest itself is public game data; fetching the user only proves the
    // caller is a client bound to a real account before it is served.
    await fetchUser();
    const gameId = getGameId(h3);
    await assertGameExists(gameId);
    return saveManager.manifestForGame(gameId);
  },
);
