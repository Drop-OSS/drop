import { json } from "stream/consumers";
import prisma from "../db/database";
import { Session, SessionProvider } from "./types";
import { Prisma } from "@prisma/client";

export default function createDBSessionHandler(): SessionProvider {
  return {
    async setSession(token, data) {
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
      const result = await prisma.session.findUnique({
        where: {
          token,
        },
      });
      if (result === null) return undefined;
      return result.data as T;
    },
    async clearSession(token) {
      await prisma.session.delete({
        where: {
          token,
        },
      });
    },
  };
}
