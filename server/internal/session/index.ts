import type { H3Event } from "h3";
import type {
  Session,
  SessionSearchTerms,
  SessionProvider,
  SessionWithToken,
} from "./types";
import { randomUUID } from "node:crypto";
import { parse as parseCookies } from "cookie-es";
import type { MinimumRequestObject } from "~/server/h3";
import type { DurationLike } from "luxon";
import { DateTime } from "luxon";
import createDBSessionHandler from "./db";
import prisma from "../db/database";

/*
This implementation may need work.

It exposes an API that should stay static, but there are plenty of opportunities for optimisation/organisation under the hood
*/

// 10 minutes
const SUPERLEVEL_LENGTH = 10 * 60 * 1000;

const dropTokenCookieName = "drop-token";
const normalSessionLength: DurationLike = {
  days: 31,
};
const extendedSessionLength: DurationLike = {
  year: 1,
};

type SigninResult = ["signin", "2fa", "fail"][number];
export interface SigninOptions {
  // default value: false
  rememberMe?: boolean;

  // set default session data
  data?: Session["data"];

  // set oidc session data
  oidc?: Session["oidc"];
}

export class SessionHandler {
  private sessionProvider: SessionProvider;

  constructor() {
    // Create a new provider
    // this.sessionProvider = createCacheSessionProvider();
    this.sessionProvider = createDBSessionHandler();
    // this.sessionProvider = createMemorySessionProvider();
  }

  async signin(
    h3: H3Event,
    userId: string,
    options?: SigninOptions,
  ): Promise<SigninResult> {
    const mfaCount = await prisma.linkedMFAMec.count({
      where: { userId, enabled: true },
    });

    const rememberMe = options?.rememberMe ?? false;
    const data = options?.data ?? {};
    const oidcData = options?.oidc;

    const expiresAt = this.createExipreAt(rememberMe);

    const token =
      this.getSessionToken(h3) ?? this.createSessionCookie(h3, expiresAt);
    const defaultSession: Session = {
      expiresAt,
      data,
    };
    const session =
      (await this.sessionProvider.getSession(token)) ?? defaultSession;
    const wasAuthenticated = !!session.authenticated;

    // set authenticated session data
    session.authenticated = {
      userId,
      level: session.authenticated?.level ?? 10,
      requiredLevel: mfaCount > 0 ? 20 : 10,
      superleveledExpiry: undefined,
    };
    if (oidcData) session.oidc = oidcData;

    // handle superlevel expiry
    if (
      wasAuthenticated &&
      session.authenticated.level >= session.authenticated.requiredLevel
    ) {
      session.authenticated.superleveledExpiry = Date.now() + SUPERLEVEL_LENGTH;
    }
    const success = await this.sessionProvider.setSession(token, session);
    if (!success) return "fail";

    if (session.authenticated.level < session.authenticated.requiredLevel)
      return "2fa";
    return "signin";
  }

  async mfa(h3: H3Event, amount: number) {
    const token = this.getSessionToken(h3);
    if (!token)
      throw createError({ statusCode: 403, message: "User not signed in" });
    const session = await this.sessionProvider.getSession(token);
    if (!session || !session.authenticated)
      throw createError({ statusCode: 403, message: "User not signed in" });

    session.authenticated.level += amount;
    await this.sessionProvider.setSession(token, session);
  }

  /**
   * Get a session associated with a request
   * @returns session
   */
  async getSession<T extends SessionWithToken>(request: MinimumRequestObject) {
    const token = this.getSessionToken(request);
    if (!token) return undefined;

    const session = await this.sessionProvider.getSession<T>(token);
    if (!session) return undefined;

    // if expired session
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await this.sessionProvider.removeSession(token);
      // TODO: should probably call signout to clear the cookie
      // session expired
      return undefined;
    }
    return session;
  }

  async getSessionDataKey<T>(
    request: MinimumRequestObject,
    key: string,
  ): Promise<T | undefined> {
    const token = this.getSessionToken(request);
    if (!token) return undefined;

    const session = await this.sessionProvider.getSession(token);
    if (!session) return undefined;
    return session.data[key] as T;
  }

  async setSessionDataKey<T>(request: H3Event, key: string, value: T) {
    const expiresAt = this.createExipreAt(true);

    const token =
      this.getSessionToken(request) ??
      this.createSessionCookie(request, expiresAt);

    const defaultSession: Session = {
      expiresAt,
      data: {},
    };
    const session =
      (await this.sessionProvider.getSession(token)) ?? defaultSession;
    console.log(session);
    session.data[key] = value;
    await this.sessionProvider.setSession(token, session);
    return true;
  }

  async deleteSessionDataKey(request: MinimumRequestObject, key: string) {
    const token = this.getSessionToken(request);
    if (!token) return false;

    const session = await this.sessionProvider.getSession(token);
    if (!session) return false;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete session.data[key];
    await this.sessionProvider.setSession(token, session);
    return true;
  }

  /**
   * Signout session associated with request and deauthenticates it
   * @param request
   * @returns
   */
  async signout(h3: H3Event) {
    const token = this.getSessionToken(h3);
    if (!token) return false;
    if (!this.signoutByToken(token)) return false;
    deleteCookie(h3, dropTokenCookieName);
    return true;
  }

  /**
   * Signout session by token
   * @Note Should only be used in special cases (eg OIDC logout)
   * @param token
   * @returns
   */
  async signoutByToken(token: string) {
    const res = await this.sessionProvider.removeSession(token);
    return res;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupSessions() {
    await this.sessionProvider.cleanupSessions();
  }

  /**
   * Search sessions
   * @param terms search terms
   * @returns found sessions
   */
  async searchSessions(terms: SessionSearchTerms) {
    return await this.sessionProvider.findSessions(terms);
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
    request: MinimumRequestObject | undefined,
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
