import { http, HttpResponse, type HttpHandler } from "msw";

/**
 * Default mock OIDC configuration endpoint values.
 * Matches the shape expected by OIDCManager (well-known / OIDCWellKnownV1).
 */
export const DEFAULT_OIDC_CONFIG = {
  issuer: "https://mock-oidc.heretek.dev",
  authorization_endpoint: "https://mock-oidc.heretek.dev/auth",
  token_endpoint: "https://mock-oidc.heretek.dev/token",
  userinfo_endpoint: "https://mock-oidc.heretek.dev/userinfo",
  jwks_uri: "https://mock-oidc.heretek.dev/jwks",
  scopes_supported: ["openid", "profile", "email"],
};

/** Default mock token response (OIDCTokenResponseV1 shape). */
export const DEFAULT_OIDC_TOKEN_RESPONSE = {
  access_token: "mock-access-token",
  id_token: "mock-id-token",
  token_type: "Bearer",
  expires_in: 3600,
  scope: "openid profile email",
};

/** Default mock userinfo response (OIDCUserInfo shape). */
export const DEFAULT_OIDC_USERINFO_RESPONSE = {
  sub: "mock-oidc-user-123",
  name: "Mock OIDC User",
  preferred_username: "mockuser",
  email: "mockuser@heretek.dev",
  picture: "",
  groups: ["drop-users"],
};

/**
 * Create MSW handlers for OIDC provider endpoints.
 *
 * Override responses by calling with custom partials:
 * ```
 * oidcHandlers({ userinfo: { sub: "custom-sub", groups: ["drop-admins"] } })
 * ```
 */
export function oidcHandlers(
  overrides?: {
    config?: Partial<typeof DEFAULT_OIDC_CONFIG>;
    token?: Partial<typeof DEFAULT_OIDC_TOKEN_RESPONSE>;
    userinfo?: Partial<typeof DEFAULT_OIDC_USERINFO_RESPONSE>;
  },
): HttpHandler[] {
  const config = { ...DEFAULT_OIDC_CONFIG, ...overrides?.config };
  const token = { ...DEFAULT_OIDC_TOKEN_RESPONSE, ...overrides?.token };
  const userinfo = { ...DEFAULT_OIDC_USERINFO_RESPONSE, ...overrides?.userinfo };

  const key = crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );

  return [
    // OIDC well-known configuration endpoint
    http.get(config.jwks_uri.replace("/jwks", "/.well-known/openid-configuration"), () =>
      HttpResponse.json(config),
    ),

    // Also match a generic well-known URL pattern
    http.get("https://mock-oidc.heretek.dev/.well-known/openid-configuration", () =>
      HttpResponse.json(config),
    ),

    // Token endpoint
    http.post(config.token_endpoint, () =>
      HttpResponse.json(token),
    ),

    // Userinfo endpoint
    http.get(config.userinfo_endpoint, () =>
      HttpResponse.json(userinfo),
    ),
    http.post(config.userinfo_endpoint, () =>
      HttpResponse.json(userinfo),
    ),

    // JWKS endpoint — return an empty key set by default; tests that need
    // real JWT verification should use the jwt.ts helpers instead.
    http.get(config.jwks_uri, () =>
      HttpResponse.json({ keys: [] }),
    ),
  ];
}

/** Pre-built handler array with default values — use for most tests. */
export const defaultOidcHandlers = oidcHandlers();
