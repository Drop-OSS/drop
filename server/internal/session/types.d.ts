export type Session = {
  authenticated?: AuthenticatedSession;

  expiresAt: Date;
  data: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;

    // OIDC specific session data
    odic?: {
      sid?: string;
      sub?: string;
      iss: string;
    };
  };
};

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

export interface SessionFindTerms {
  userId?: string;
  data: {
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
  findSessions: (options: SessionFindTerms) => Promise<SessionWithToken[]>;
}
