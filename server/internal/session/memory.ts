import type { Session, SessionProvider } from "./types";

export default function createMemorySessionHandler() {
  const sessions = new Map<string, Session>();

  const memoryProvider: SessionProvider = {
    async setSession(token, data) {
      sessions.set(token, data);
      return true;
    },
    async getSession<T extends Session>(token: string): Promise<T | undefined> {
      const session = sessions.get(token);
      return session ? (session as T) : undefined; // Ensure undefined is returned if session is not found
    },
    async updateSession(token, data) {
      return this.setSession(token, data);
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
  };

  return memoryProvider;
}
