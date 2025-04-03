import { Session, SessionProvider } from "./types";

export default function createMemorySessionHandler() {
  const sessions: { [key: string]: Session } = {};

  const memoryProvider: SessionProvider = {
    async setSession(token, data) {
      sessions[token] = data;
      return true;
    },
    async getSession<T extends Session>(token: string): Promise<T | undefined> {
      const session = sessions[token];
      return session ? (session as T) : undefined; // Ensure undefined is returned if session is not found
    },
    async updateSession(token, data) {
      return this.setSession(token, data);
    },
    async removeSession(token) {
      delete sessions[token];
      return true;
    },
    async cleanupSessions() {
      const now = new Date();
      for (let token in sessions) {
        // if expires at time is before now, the session is expired
        if (sessions[token].expiresAt < now) await this.removeSession(token);
      }
    },
  };

  return memoryProvider;
}
