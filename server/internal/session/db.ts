import prisma from "../db/database";
import type { SessionProvider, SessionWithToken } from "./types";
import cacheHandler from "../cache";

export default function createDBSessionHandler(): SessionProvider {
  const cache = cacheHandler.createCache<SessionWithToken>("DBSession");

  return {
    async setSession(token, session) {
      await cache.set(token, { ...session, token });

      const result = await prisma.session.upsert({
        where: {
          token,
        },
        create: {
          token,
          ...(session.authenticated?.userId
            ? { userId: session.authenticated?.userId }
            : undefined),
          expiresAt: session.expiresAt,
          data: session as object,
        },

        update: {
          expiresAt: session.expiresAt,
          data: session as object,
        },
      });

      // need to cast to Session since prisma returns different json types
      return result as SessionWithToken;
    },
    async updateSession(token, data) {
      return (await this.setSession(token, data)) !== undefined;
    },
    async getSession<T extends SessionWithToken>(token: string) {
      const cached = await cache.get(token);
      if (cached !== null) return cached as T;

      const result = await prisma.session.findUnique({
        where: {
          token,
        },
      });
      if (result === null) return undefined;

      // add to cache
      // need to cast to Session since prisma returns a more specific type
      await cache.set(token, result as SessionWithToken);

      // i hate casting
      // need to cast to unknown since result.data can be an N deep json object technically
      // ts doesn't like that be cast down to the more constraining session type
      return result.data as unknown as T;
    },
    async removeSession(token) {
      await cache.remove(token);
      const { count } = await prisma.session.deleteMany({
        where: {
          token,
        },
      });
      return count > 0;
    },
    async cleanupSessions() {
      const now = new Date();

      await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });
    },
    async findSessions(_options) {
      return [];
    },
  };
}
