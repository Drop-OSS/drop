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
    async setSession(token, data) {
      cache.set(token, data);

      //   const strData = JSON.stringify(data);
      await prisma.session.upsert({
        where: {
          token,
        },
        create: {
          token,
          data,
        },
        update: {
          data,
        },
      });
      return true;
    },
    async updateSession(token, key, data) {
      const newObj: { [key: string]: any } = {};
      newObj[key] = data;
      cache.set(token, newObj);

      const session = await prisma.session.upsert({
        where: {
          token,
        },
        create: {
          token,
          data: newObj,
        },
        update: {},
      });

      // if json object and not arrary, update session
      if (
        typeof session.data === "object" &&
        !Array.isArray(session.data) &&
        session.data !== null
      ) {
        // means we set it above
        if (session.data[key] === data) return true;

        // else we need to set it ourselves
        (session.data as Prisma.JsonObject)[key] = data;
        await prisma.session.update({
          where: {
            token,
          },
          data: {
            data: session.data,
          },
        });
        return true;
      }
      return false;
    },
    async getSession<T>(token: string) {
      const cached = cache.get(token);
      if (cached !== undefined) return cached as T;

      const result = await prisma.session.findUnique({
        where: {
          token,
        },
      });
      if (result === null) return undefined;
      return result.data as T;
    },
    async clearSession(token) {
      cache.delete(token);
      await prisma.session.delete({
        where: {
          token,
        },
      });
    },
  };
}
