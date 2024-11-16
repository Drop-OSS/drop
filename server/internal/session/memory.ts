import { Session, SessionProvider } from "./types";

export default function createMemorySessionHandler() {
  const sessions: { [key: string]: Session } = {};

  const memoryProvider: SessionProvider = {
    async setSession(token, data) {
      sessions[token] = data;
      return true;
    },
    async updateSession(token, key, data) {
      sessions[token] = Object.assign({}, sessions[token], { [key]: data });
      return true;
    },
    async getSession(token) {
      return sessions[token] as any; // Wild type cast because we let the user specify types if they want
    },
    async clearSession(token) {
      delete sessions[token];
    },
  };

  return memoryProvider;
}
