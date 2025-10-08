/*
Handles managing collections
*/

import cacheHandler from "../cache";
import prisma from "../db/database";
import { DateTime } from "luxon";

type UserStats = {
  activeSessions: number;
  userCount: number;
};

class AdminHomeManager {
  // Caches the user's core library
  private userStatsCache = cacheHandler.createCache<UserStats>("adminHome");

  async getUserStats() {
    const cached = await this.userStatsCache.get("userStats");
    if (cached !== null) return cached;

    const activeSessions = (
      await prisma.client.groupBy({
        by: ["userId"],
        where: {
          id: { not: "system" },
          lastConnected: {
            gt: DateTime.now().minus({ months: 1 }).toISO(),
          },
        },
      })
    ).length;
    const userCount = await prisma.user.count({
      where: { id: { not: "system" } },
    });
    const userStats = { activeSessions, userCount };

    await this.userStatsCache.set("userStats", userStats);

    return userStats;
  }
}

export const manager = new AdminHomeManager();
export default manager;
