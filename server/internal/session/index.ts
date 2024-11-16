import { H3Event, Session } from "h3";
import createMemorySessionProvider from "./memory";
import { SessionProvider } from "./types";
import prisma from "../db/database";
import { v4 as uuidv4 } from "uuid";
import moment from "moment";

/*
This implementation may need work.

It exposes an API that should stay static, but there are plenty of opportunities for optimisation/organisation under the hood
*/

const userSessionKey = "_userSession";
const userIdKey = "_userId";
const dropTokenCookie = "drop-token";
const normalSessionLength = [31, "days"];
const extendedSessionLength = [1, "year"];

export class SessionHandler {
  private sessionProvider: SessionProvider;

  constructor() {
    // Create a new provider
    this.sessionProvider = createMemorySessionProvider();
  }

  private getSessionToken(h3: H3Event) {
    const cookie = getCookie(h3, dropTokenCookie);
    return cookie;
  }

  private async createSession(h3: H3Event, extend = false) {
    const token = uuidv4();
    const expiry = moment().add(
      ...(extend ? extendedSessionLength : normalSessionLength)
    );

    setCookie(h3, dropTokenCookie, token, { expires: expiry.toDate() });

    this.sessionProvider.setSession(dropTokenCookie, {});

    return token;
  }

  async getSession<T extends Session>(h3: H3Event) {
    const token = this.getSessionToken(h3);
    if (!token) return undefined;
    const data = await this.sessionProvider.getSession<{ [userSessionKey]: T }>(
      token
    );
    if (!data) return undefined;

    return data[userSessionKey];
  }
  async setSession(h3: H3Event, data: any, extend = false) {
    const token =
      this.getSessionToken(h3) ?? (await this.createSession(h3, extend));
    const result = await this.sessionProvider.updateSession(
      token,
      userSessionKey,
      data
    );

    return result;
  }
  async clearSession(h3: H3Event) {
    const token = this.getSessionToken(h3);
    if (!token) return false;
    await this.sessionProvider.clearSession(token);
    return true;
  }

  async getUserId(h3: H3Event, tag: string | boolean = false) {
    const token = this.getSessionToken(h3);
    if (!token) return undefined;

    const session = await this.sessionProvider.getSession<{
      [userIdKey]: string | undefined;
    }>(token);

    if (tag)
      console.log(`${tag} ${JSON.stringify(h3)} ${JSON.stringify(session)}`);

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
    const token =
      this.getSessionToken(h3) ?? (await this.createSession(h3, extend));

    const result = await this.sessionProvider.updateSession(
      token,
      userIdKey,
      userId
    );
  }

  async getAdminUser(h3: H3Event) {
    const user = await this.getUser(h3);
    if (!user) return undefined;
    if (!user.admin) return undefined;
    return user;
  }
}

export default new SessionHandler();
