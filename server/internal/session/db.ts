import prisma from "../db/database";
import type { SessionProvider, SessionWithToken } from "./types";
import cacheHandler from "../cache";
import type { SessionWhereInput, JsonFilter } from "~/prisma/client/models";
import type { InputJsonValue } from "@prisma/client/runtime/library";

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
    async findSessions(options) {
      const search: SessionWhereInput[] = [];
      if (options.userId) {
        search.push({ userId: options.userId });
      }

      if (options.data && typeof options.data === "object") {
        const entries = walkJsonPath(options.data);
        for (const { path, value } of entries) {
          const filter: JsonFilter<"Session"> = {
            path,
            equals: value as InputJsonValue,
          };
          search.push({ data: filter });
        }
      }

      if (search.length === 0) {
        return [];
      }

      const results = await prisma.session.findMany({
        where: {
          AND: search,
        },
      });

      return results as SessionWithToken[];
    },
  };
}

/**
 * Walks a JSON object and returns all paths and their corresponding values.
 * @param obj The JSON object to walk.
 * @param basePath The base path to start from (used for recursion).
 * @returns An array of objects containing the path and value.
 */
function walkJsonPath(
  obj: unknown,
  basePath: string[] = [],
): Array<{ path: string[]; value: unknown }> {
  const results: Array<{ path: string[]; value: unknown }> = [];

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const v = obj[i];
      if (v === undefined) continue;
      if (v !== null && typeof v === "object") {
        results.push(...walkJsonPath(v, [...basePath, String(i)]));
      } else {
        results.push({ path: [...basePath, String(i)], value: v });
      }
    }
    return results;
  }

  if (obj !== null && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === undefined) continue;
      if (v !== null && typeof v === "object") {
        results.push(...walkJsonPath(v, [...basePath, k]));
      } else {
        results.push({ path: [...basePath, k], value: v });
      }
    }
    return results;
  }

  if (basePath.length > 0) {
    results.push({ path: basePath, value: obj });
  }
  return results;
}
