import { defineClientEventHandler } from "~/server/internal/clients/event-handler";

export default defineClientEventHandler(async (h3) => {
  const query = getQuery(h3);

  const gameId = query.game;
  const versionName = query.version;
  const chunkId = query.chunk;
});
