import prisma from "../db/database";

class PlaytimeManager {
  /**
   * Get a user's playtime on a game
   * @param gameId
   * @param userId
   * @returns
   */
  async get(gameId: string, userId: string) {
    return await prisma.playtime.findUnique({
      where: {
        gameId_userId: {
          gameId,
          userId,
        },
      },
    });
  }

  /**
   * Add time to a user's playtime
   * @param gameId
   * @param userId
   * @param seconds seconds played
   */
  async add(gameId: string, userId: string, seconds: number) {
    await prisma.playtime.upsert({
      where: {
        gameId_userId: {
          gameId,
          userId,
        },
      },
      create: {
        gameId,
        userId,
        seconds,
      },
      update: {
        seconds: {
          increment: seconds,
        },
      },
    });
  }
}

export const playtimeManager = new PlaytimeManager();
export default playtimeManager;
