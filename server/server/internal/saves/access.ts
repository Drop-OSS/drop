import { createError } from "h3";
import prisma from "../db/database";

/**
 * Save rows are keyed by (userId, gameId, index) and their objects are only
 * readable by their owner, so a client can never reach another user's data.
 * The game ID still has to exist, exactly as before versioning: clients back up
 * saves for whatever they run, including games installed outside the server's
 * library, so membership is deliberately not required here.
 */
export async function assertGameExists(gameId: string): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true },
  });
  if (!game)
    throw createError({ statusCode: 400, statusMessage: "Invalid game ID" });
}
