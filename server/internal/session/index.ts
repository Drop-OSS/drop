import { H3Event, Session } from "h3";
import createMemorySessionProvider from "./memory";
import { SessionProvider } from "./types";
import prisma from "../db/database";
import { v4 as uuidv4 } from "uuid";
import moment from "moment";
import { parse as parseCookies } from "cookie-es";
import { MinimumRequestObject } from "~/server/h3";

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

  private getSessionToken(request: MinimumRequestObject | undefined) {
    if(!request) throw new Error("Native web request not available");
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) return undefined;
    const cookies = parseCookies(cookieHeader);
    const cookie = cookies[dropTokenCookie];
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

  getDropTokenCookie() {
    return dropTokenCookie;
  }

  async getSession<T extends Session>(request: MinimumRequestObject) {
    const token = this.getSessionToken(request);
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
  async clearSession(request: MinimumRequestObject) {
    const token = this.getSessionToken(request);
    if (!token) return false;
    await this.sessionProvider.clearSession(token);
    return true;
  }

  async getUserId(h3: MinimumRequestObject) {
    const token = this.getSessionToken(h3);
    if (!token) return undefined;

    return await this.getUserIdRaw(token);
  }
  async getUserIdRaw(token: string) {
    const session = await this.sessionProvider.getSession<{
      [userIdKey]: string | undefined;
    }>(token);

    if (!session) return undefined;

    return session[userIdKey];
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
}

export const sessionHandler = new SessionHandler();
export default sessionHandler;
