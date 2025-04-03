import { H3Event } from "h3";

export type Session = {
  userId: string;
  expiresAt: Date;
  data: {
    [key: string]: any;
  };
};

export interface SessionProvider {
  getSession: <T extends Session>(token: string) => Promise<T | undefined>;
  setSession: (token: string, data: Session) => Promise<boolean>;
  updateSession: (token: string, data: Session) => Promise<boolean>;
  removeSession: (token: string) => Promise<boolean>;
  cleanupSessions: () => Promise<void>;
}
