import type { Session, SessionProvider } from "./types";

export default function createMemorySessionHandler() {
  const sessions = new Map<string, Session>();

  const memoryProvider: SessionProvider = {
    async setSession(token, data) {
      sessions.set(token, data);
      return data;
    },
    async getSession<T extends Session>(token: string): Promise<T | undefined> {
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
    async cleanupSessions() {
      const now = new Date();
      for (const [token, session] of sessions) {
        // if expires at time is before now, the session is expired
        if (session.expiresAt < now) await this.removeSession(token);
      }
    },
    async findSessions(options) {
      const results: Session[] = [];
      for (const session of sessions.values()) {
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
