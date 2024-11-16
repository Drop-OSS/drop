import { H3Event } from "h3";

export type Session = { [key: string]: any };

export interface SessionProvider {
  setSession: (token: string, data: Session) => Promise<boolean>;
  updateSession: (token: string, key: string, data: any) => Promise<boolean>;
  getSession: <T extends Session>(token: string) => Promise<T | undefined>;
  clearSession: (token: string) => Promise<void>;
}
