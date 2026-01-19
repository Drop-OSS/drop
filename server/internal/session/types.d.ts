export type Session = {
  authenticated?: AuthenticatedSession;
  oidc?: OIDCData;

  expiresAt: Date;
  data: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
};

export interface OIDCData {
  sid?: string;
  sub?: string;
  iss: string;
}

export interface AuthenticatedSession {
  userId: string;
  level: number;
  requiredLevel: number;
  superleveledExpiry: number | undefined;
}

/**
 * A more complete session type that includes the token to identify it
 */
export type SessionWithToken = Session & {
  token: string;
};

export interface SessionSearchTerms {
  userId?: string;
  oidc?: OIDCData;
  data?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

export interface SessionProvider {
  getSession: <T extends SessionWithToken>(
    token: string,
  ) => Promise<T | undefined>;
  setSession: (
    token: string,
    data: Session,
  ) => Promise<SessionWithToken | undefined>;
  updateSession: (token: string, data: Session) => Promise<boolean>;
  removeSession: (token: string) => Promise<boolean>;
  cleanupSessions: () => Promise<void>;
  findSessions: (options: SessionSearchTerms) => Promise<SessionWithToken[]>;
}
