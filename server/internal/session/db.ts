import { LRUCache } from "lru-cache";
import prisma from "../db/database";
import { Session, SessionProvider } from "./types";
import { Prisma } from "@prisma/client";

export default function createDBSessionHandler(): SessionProvider {
  const cache = new LRUCache<string, Session>({
    max: 50, // number of items
    ttl: 30 * 100, // 30s (in ms)
  });

  return {
    async setSession(token, session) {
      cache.set(token, session);

      //   const strData = JSON.stringify(data);
      await prisma.session.upsert({
        where: {
          token,
        },
        create: {
          token,
          ...session,
        },
        update: session,
      });
      return true;
    },
    async updateSession(token, data) {
      return await this.setSession(token, data);
    },
    async getSession<T extends Session>(token: string) {
      const cached = cache.get(token);
      if (cached !== undefined) return cached as T;

      const result = await prisma.session.findUnique({
        where: {
          token,
        },
      });
      if (result === null) return undefined;

      // i hate casting
      // need to cast to unknown since result.data can be an N deep json object technically
      // ts doesn't like that be cast down to the more constraining session type
      return result as unknown as T;
    },
    async removeSession(token) {
      cache.delete(token);
      await prisma.session.delete({
        where: {
          token,
        },
      });
      return true;
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
  };
}
