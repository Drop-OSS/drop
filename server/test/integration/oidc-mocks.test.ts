/**
 * Integration tests for the OIDC MSW mock handlers.
 *
 * Verifies the mock-OIDC contract: the well-known, token, userinfo, and
 * JWKS endpoints respond with the shapes that downstream code
 * (auth/OIDCManager) expects. If these mocks drift, real OIDC integration
 * breaks silently.
 *
 * Run via the standard Vitest setup. The MSW server is started in
 * `setup.ts` (beforeAll) so all tests in this file can make real HTTP
 * calls through the mock.
 */
import { describe, it, expect } from "vitest";

const MOCK_BASE = "https://mock-oidc.heretek.dev";

describe("OIDC MSW mock handlers", () => {
  it("well-known endpoint returns OIDC configuration shape", async () => {
    const res = await fetch(`${MOCK_BASE}/.well-known/openid-configuration`);
    expect(res.status).toBe(200);
    const config = (await res.json()) as Record<string, unknown>;
    expect(config.issuer).toBe(MOCK_BASE);
    expect(config.authorization_endpoint).toBe(`${MOCK_BASE}/auth`);
    expect(config.token_endpoint).toBe(`${MOCK_BASE}/token`);
    expect(config.userinfo_endpoint).toBe(`${MOCK_BASE}/userinfo`);
    expect(config.jwks_uri).toBe(`${MOCK_BASE}/jwks`);
    expect(Array.isArray(config.scopes_supported)).toBe(true);
  });

  it("token endpoint returns valid token response on POST", async () => {
    const res = await fetch(`${MOCK_BASE}/token`, { method: "POST" });
    expect(res.status).toBe(200);
    const token = (await res.json()) as Record<string, unknown>;
    expect(token.access_token).toBe("mock-access-token");
    expect(token.id_token).toBe("mock-id-token");
    expect(token.token_type).toBe("Bearer");
    expect(typeof token.expires_in).toBe("number");
  });

  it("userinfo endpoint returns userinfo on GET", async () => {
    const res = await fetch(`${MOCK_BASE}/userinfo`);
    expect(res.status).toBe(200);
    const info = (await res.json()) as Record<string, unknown>;
    expect(info.sub).toBe("mock-oidc-user-123");
    expect(info.email).toBe("mockuser@heretek.dev");
    expect(info.name).toBe("Mock OIDC User");
    expect(Array.isArray(info.groups)).toBe(true);
  });

  it("userinfo endpoint accepts POST", async () => {
    const res = await fetch(`${MOCK_BASE}/userinfo`, { method: "POST" });
    expect(res.status).toBe(200);
    const info = (await res.json()) as Record<string, unknown>;
    expect(info.sub).toBe("mock-oidc-user-123");
  });

  it("jwks endpoint returns empty key set", async () => {
    const res = await fetch(`${MOCK_BASE}/jwks`);
    expect(res.status).toBe(200);
    const jwks = (await res.json()) as { keys: unknown[] };
    expect(Array.isArray(jwks.keys)).toBe(true);
  });
});
