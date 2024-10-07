import moment from "moment";
import { Session, SessionProvider } from "./types";
import { v4 as uuidv4 } from "uuid";

export default function createMemorySessionHandler() {
  const sessions: { [key: string]: Session } = {};

  const sessionCookieName = "drop-session";

  const memoryProvider: SessionProvider = {
    async setSession(h3, data, extend = false) {
      const existingCookie = getCookie(h3, sessionCookieName);
      if (existingCookie) delete sessions[existingCookie]; // Clear any previous session

      const cookie = uuidv4();
      const expiry = moment().add(31, extend ? "month" : "day");
      setCookie(h3, sessionCookieName, cookie, { expires: expiry.toDate() });

      sessions[cookie] = data;
      return true;
    },
    async updateSession(h3, key, data) {
      const cookie = getCookie(h3, sessionCookieName);
      if (!cookie) return false;

      sessions[cookie] = Object.assign({}, sessions[cookie], { [key]: data });
      return true;
    },
    async getSession(h3) {
      const cookie = getCookie(h3, sessionCookieName);
      if (!cookie) return undefined;

      return sessions[cookie] as any; // Wild type cast because we let the user specify types if they want
    },
    async clearSession(h3) {
      const cookie = getCookie(h3, sessionCookieName);
      if (!cookie) return;

      delete sessions[cookie];
      deleteCookie(h3, sessionCookieName);
    },
  };

  return memoryProvider;
}
