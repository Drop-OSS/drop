import * as jose from "jose";

/**
 * Generate an RSA key pair for signing test JWTs.
 *
 * Use once at setup, then call {@link signToken} / {@link createJWKS} with
 * the same {@link JwtKeyFixture}.
 */
export async function generateKeyFixture(): Promise<JwtKeyFixture> {
  const { privateKey, publicKey } = await jose.generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true,
  });
  return { privateKey, publicKey };
}

export interface JwtKeyFixture {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

export interface IdTokenClaims extends jose.JWTPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  auth_time?: number;
  nonce?: string;
  sid?: string;
}

/**
 * Sign an OIDC ID token payload using the fixture's private key.
 *
 * ```ts
 * const keyFixture = await generateKeyFixture();
 * const idToken = await signToken(keyFixture, {
 *   iss: "https://mock-oidc.heretek.dev",
 *   sub: "user-abc",
 *   aud: "mock-client-id",
 *   exp: Math.floor(Date.now() / 1000) + 3600,
 *   iat: Math.floor(Date.now() / 1000),
 * });
 * ```
 */
export async function signToken(
  fixture: JwtKeyFixture,
  payload: IdTokenClaims,
): Promise<string> {
  return await new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "RS256" })
    .sign(fixture.privateKey);
}

/**
 * Create a JWKS response body containing the public key from a fixture.
 * Pass this as the response from the `jwks_uri` endpoint.
 *
 * ```ts
 * import { createJWKS } from "./jwt";
 *
 * http.get("https://mock-oidc.heretek.dev/jwks", () =>
 *   HttpResponse.json(await createJWKS(keyFixture)),
 * )
 * ```
 */
export async function createJWKS(
  fixture: JwtKeyFixture,
): Promise<{ keys: jose.JWK[] }> {
  const jwk = await jose.exportJWK(fixture.publicKey);
  // Ensure the key has the correct 'use' and 'alg' for JWKS
  jwk.use = "sig";
  jwk.alg = "RS256";
  // Include the key ID for kid-based key selection
  if (!jwk.kid) {
    jwk.kid = "mock-key-1";
  }
  return { keys: [jwk] };
}

/**
 * Verify an RS256 JWT using the fixture's public key.
 * Returns the verified payload, or throws if verification fails.
 */
export async function verifyToken(
  fixture: JwtKeyFixture,
  token: string,
  options?: jose.VerifyOptions,
): Promise<jose.JWTPayload> {
  const { payload } = await jose.jwtVerify(token, fixture.publicKey, options);
  return payload;
}

/**
 * Build an OIDC ID token for the mock user with sensible defaults.
 */
export function buildIdTokenPayload(
  overrides?: Partial<IdTokenClaims>,
): IdTokenClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://mock-oidc.heretek.dev",
    sub: "mock-oidc-user-123",
    aud: "mock-client-id",
    exp: now + 3600,
    iat: now,
    ...overrides,
  };
}
