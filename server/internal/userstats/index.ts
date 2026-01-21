/*
Handles managing collections
*/

import cacheHandler from "../cache";
import prisma from "../db/database";
import sessionHandler from "../session";

class UserStatsManager {
  // Caches the user's core library
  private userStatsCache = cacheHandler.createCache<number>("userStats");

  async cacheUserSessions() {
    const activeSessions = await sessionHandler.getNumberActiveSessions();
    await this.userStatsCache.set("activeSessions", activeSessions);
  }

  private async cacheUserCount() {
    const userCount =
      (await prisma.user.count({
        where: { id: { not: "system" } },
      })) || 0;
    await this.userStatsCache.set("userCount", userCount);
  }

  async cacheUserStats() {
    await this.cacheUserSessions();
    await this.cacheUserCount();
  }

  async getUserStats() {
    let activeSessions = await this.userStatsCache.get("activeSessions");
    let userCount = await this.userStatsCache.get("userCount");

    if (activeSessions === null || userCount === null) {
      await this.cacheUserStats();
      activeSessions = (await this.userStatsCache.get("activeSessions")) || 0;
      userCount = (await this.userStatsCache.get("userCount")) || 0;
    }

    return { activeSessions, userCount };
  }

  async addUser() {
    const userCount = (await this.userStatsCache.get("userCount")) || 0;
    await this.userStatsCache.set("userCount", userCount + 1);
  }

  async deleteUser() {
    const userCount = (await this.userStatsCache.get("userCount")) || 1;
    await this.userStatsCache.set("userCount", userCount - 1);
    await this.cacheUserSessions();
  }
}

export const manager = new UserStatsManager();
export default manager;
