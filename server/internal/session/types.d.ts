import { H3Event } from "h3";

export type Session = { [key: string]: any };

export interface SessionProvider {
    setSession: (h3: H3Event, data: Session) => Promise<boolean>;
    updateSession: (h3: H3Event, key: string, data: any) => Promise<boolean>;
    getSession: <T extends Session>(h3: H3Event) => Promise<T | undefined>;
    clearSession: (h3: H3Event) => Promise<void>;
}