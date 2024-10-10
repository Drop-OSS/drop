import { H3Event, Session } from "h3";
import createMemorySessionProvider from "./memory";
import { SessionProvider } from "./types";
import prisma from "../db/database";

/*
This is a poorly organised implemention.

It exposes an API that should stay static, but there are plenty of opportunities for optimisation/organisation under the hood
*/

const userSessionKey = "_userSession";
const userIdKey = "_userId";

export class SessionHandler {
  private sessionProvider: SessionProvider;

  constructor() {
    // Create a new provider
    this.sessionProvider = createMemorySessionProvider();
  }

  async getSession<T extends Session>(h3: H3Event) {
    const data = await this.sessionProvider.getSession<{ [userSessionKey]: T }>(
      h3
    );
    if (!data) return undefined;

    return data[userSessionKey];
  }
  async setSession(h3: H3Event, data: any, expend = false) {
    const result = await this.sessionProvider.updateSession(
      h3,
      userSessionKey,
      data
    );
    if (!result) {
      const toCreate = { [userSessionKey]: data };
      await this.sessionProvider.setSession(h3, toCreate, expend);
    }
  }
  async clearSession(h3: H3Event) {
    await this.sessionProvider.clearSession(h3);
  }

  async getUserId(h3: H3Event) {
    const session = await this.sessionProvider.getSession<{
      [userIdKey]: string | undefined;
    }>(h3);
    if (!session) return undefined;

    return session[userIdKey];
  }

  async getUser(h3: H3Event) {
    const userId = await this.getUserId(h3);
    if (!userId) return undefined;

    const user = await prisma.user.findFirst({ where: { id: userId } });
    return user;
  }

  async setUserId(h3: H3Event, userId: string, extend = false) {
    const result = await this.sessionProvider.updateSession(
      h3,
      userIdKey,
      userId
    );
    if (!result) {
      const toCreate = { [userIdKey]: userId };
      await this.sessionProvider.setSession(h3, toCreate, extend);
    }
  }

  async getAdminUser(h3: H3Event) {
    const user = await this.getUser(h3);
    if (!user) return undefined;
    if (!user.admin) return undefined;
    return user;
  }
}

export default new SessionHandler();
