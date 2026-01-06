import cacheHandler from "../cache";
import type { Session, SessionProvider } from "./types";

/**
 * DO NOT USE THIS. THE CACHE EVICTS SESSIONS.
 *
 * This needs work. TODO.
 */
export default function createCacheSessionProvider() {
  const sessions = cacheHandler.createCache<Session>("cacheSessionProvider");

  const memoryProvider: SessionProvider = {
    async setSession(token, data) {
      await sessions.set(token, data);
      return data;
    },
    async getSession<T extends Session>(token: string): Promise<T | undefined> {
      const session = await sessions.get(token);
      return session ? (session as T) : undefined; // Ensure undefined is returned if session is not found
    },
    async updateSession(token, data) {
      return (await this.setSession(token, data)) !== undefined;
    },
    async removeSession(token) {
      await sessions.remove(token);
      return true;
    },
    async cleanupSessions() {
      const now = new Date();
      for (const token of await sessions.getKeys()) {
        const session = await sessions.get(token);
        if (!session) continue;
        // if expires at time is before now, the session is expired
        if (session.expiresAt < now) await this.removeSession(token);
      }
    },
    async findSessions(options) {
      const results: Session[] = [];
      for (const token of await sessions.getKeys()) {
        const session = await sessions.get(token);
        if (!session) continue;
        let match = true;
        if (options.userId && session.userId !== options.userId) {
          match = false;
        }
        for (const [key, value] of Object.entries(options.data || {})) {
          // stringify to do deep comparison
          if (JSON.stringify(session.data[key]) !== JSON.stringify(value)) {
            match = false;
            break;
          }
        }
        if (match) {
          results.push(session);
        }
      }
      return results;
    },
  };

  return memoryProvider;
}
