import cacheHandler from "../cache";
import type { SessionProvider, SessionWithToken } from "./types";

/**
 * DO NOT USE THIS. THE CACHE EVICTS SESSIONS.
 *
 * This needs work. TODO.
 */
export default function createCacheSessionProvider() {
  const sessions = cacheHandler.createCache<SessionWithToken>(
    "cacheSessionProvider",
  );

  const memoryProvider: SessionProvider = {
    async setSession(token, data) {
      const session = { ...data, token };
      await sessions.set(token, session);
      return session;
    },
    async getSession<T extends SessionWithToken>(
      token: string,
    ): Promise<T | undefined> {
      const session = await sessions.get(token);
      return session ? (session as T) : undefined; // Ensure undefined is returned if session is not found
    },
    async getNumberActiveSessions() {
      const now = new Date();
      const allSessions = await sessions.getItems(await sessions.getKeys());
      return allSessions.filter(({ value }) => value.expiresAt > now).length;
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
      const results: SessionWithToken[] = [];
      for (const token of await sessions.getKeys()) {
        const session = await sessions.get(token);
        if (!session) continue;
        let match = true;

        if (
          options.userId &&
          session.authenticated &&
          session.authenticated.userId !== options.userId
        ) {
          match = false;
        }
        if (options.oidc && session.oidc) {
          for (const [key, value] of Object.entries(options.oidc)) {
            // stringify to do deep comparison
            if (
              JSON.stringify(
                (session.oidc as unknown as Record<string, unknown>)[key],
              ) !== JSON.stringify(value)
            ) {
              match = false;
              break;
            }
          }
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
