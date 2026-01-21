import type { SessionProvider, SessionWithToken } from "./types";

export default function createMemorySessionHandler() {
  const sessions = new Map<string, SessionWithToken>();

  const memoryProvider: SessionProvider = {
    async setSession(token, data) {
      const session = { ...data, token };
      sessions.set(token, session);
      return session;
    },
    async getSession<T extends SessionWithToken>(
      token: string,
    ): Promise<T | undefined> {
      const session = sessions.get(token);
      return session ? (session as T) : undefined; // Ensure undefined is returned if session is not found
    },
    async updateSession(token, data) {
      return (await this.setSession(token, data)) !== undefined;
    },
    async removeSession(token) {
      sessions.delete(token);
      return true;
    },
    async getNumberActiveSessions() {
      let activeSessions = 0;
      for (const [_key, session] of sessions) {
        if (session.expiresAt.getDate() > Date.now()) {
          activeSessions += 1;
        }
      }
      return activeSessions;
    },
    async cleanupSessions() {
      const now = new Date();
      for (const [token, session] of sessions) {
        // if expires at time is before now, the session is expired
        if (session.expiresAt < now) await this.removeSession(token);
      }
    },
    async findSessions(options) {
      const results: SessionWithToken[] = [];
      for (const session of sessions.values()) {
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
