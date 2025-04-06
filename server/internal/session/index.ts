import { H3Event } from "h3";
import createMemorySessionProvider from "./memory";
import { Session, SessionProvider } from "./types";
import { randomUUID } from "node:crypto";
import { parse as parseCookies } from "cookie-es";
import { MinimumRequestObject } from "~/server/h3";
import createDBSessionHandler from "./db";
import { DateTime, DurationLike } from "luxon";

/*
This implementation may need work.

It exposes an API that should stay static, but there are plenty of opportunities for optimisation/organisation under the hood
*/

const dropTokenCookieName = "drop-token";
const normalSessionLength: DurationLike = {
  days: 31,
};
const extendedSessionLength: DurationLike = {
  year: 1,
};

export class SessionHandler {
  private sessionProvider: SessionProvider;

  constructor() {
    // Create a new provider
    this.sessionProvider = createDBSessionHandler();
    // this.sessionProvider = createMemorySessionProvider();
  }

  async signin(h3: H3Event, userId: string, rememberMe: boolean = false) {
    const expiresAt = this.createExipreAt(rememberMe);
    const token = this.createSessionCookie(h3, expiresAt);
    return await this.sessionProvider.setSession(token, {
      userId,
      expiresAt,
      data: {},
    });
  }

  /**
   * Get a session associated with a request
   * @returns session
   */
  async getSession<T extends Session>(request: MinimumRequestObject) {
    const token = this.getSessionToken(request);
    if (!token) return undefined;
    // TODO: should validate if session is expired or not here, not in application code

    const data = await this.sessionProvider.getSession<T>(token);
    return data;
  }

  /**
   * Signout session associated with request and deauthenticates it
   * @param request
   * @returns
   */
  async signout(h3: H3Event) {
    const token = this.getSessionToken(h3);
    if (!token) return false;
    const res = await this.sessionProvider.removeSession(token);
    if (!res) return false;
    deleteCookie(h3, dropTokenCookieName);
    return true;
  }

  async cleanupSessions() {
    await this.sessionProvider.cleanupSessions();
  }

  /**
   * Update session info
   * @param token session token
   * @param data new session data
   * @returns success or not
   */
  private async updateSession(token: string, data: Session) {
    return await this.sessionProvider.updateSession(token, data);
  }

  // ---------------------- Private API Below ------------------------

  /**
   * Get session token on a request
   * @param request
   * @returns session token
   */
  private getSessionToken(
    request: MinimumRequestObject | undefined
  ): string | undefined {
    if (!request) throw new Error("Native web request not available");
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) return undefined;
    const cookies = parseCookies(cookieHeader);
    const cookie = cookies[dropTokenCookieName];
    return cookie;
  }

  private createExipreAt(rememberMe: boolean) {
    return DateTime.now()
      .plus(rememberMe ? extendedSessionLength : normalSessionLength)
      .toJSDate();
  }

  /**
   * Creates cookie that represents user session
   * @param h3
   * @param extend
   * @returns
   */
  private createSessionCookie(h3: H3Event, expiresAt: Date) {
    const token = randomUUID();
    // TODO: we should probably switch to jwts to minimize possibility of someone
    // trying to guess a session id (jwts let us sign + encrypt stuff in a std way)
    setCookie(h3, dropTokenCookieName, token, { expires: expiresAt });
    return token;
  }
}

export const sessionHandler = new SessionHandler();
export default sessionHandler;
