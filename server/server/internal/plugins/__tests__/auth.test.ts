import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { parseClientJwtHeader, resolveClientJwt } from "../auth";
import type { MinimumRequestObject } from "~/server/h3";

function requestWith(authorization: string): MinimumRequestObject {
  return {
    headers: new Headers({ Authorization: authorization }),
  } as unknown as MinimumRequestObject;
}

function keypair() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-384",
  });
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

function signToken(privatePem: string, overrides?: { exp?: number }) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ nbf: now, exp: overrides?.exp ?? now + 30 }, privatePem, {
    algorithm: "ES384",
  });
}

test("parseClientJwtHeader accepts only the desktop JWT scheme", () => {
  assert.deepEqual(parseClientJwtHeader("JWT client-1 abc.def.ghi"), {
    clientId: "client-1",
    token: "abc.def.ghi",
  });
  assert.equal(parseClientJwtHeader("Bearer some-token"), undefined);
  assert.equal(parseClientJwtHeader("JWT client-1"), undefined);
  assert.equal(parseClientJwtHeader(undefined), undefined);
  assert.equal(parseClientJwtHeader(""), undefined);
});

test("resolveClientJwt verifies a signed desktop JWT", async () => {
  const { privatePem, publicPem } = keypair();
  const token = signToken(privatePem);

  const userId = await resolveClientJwt(requestWith(`JWT client-1 ${token}`), {
    fetchCertificate: async () => ({ cert: publicPem }),
    fetchUser: async () => ({ id: "user-1", admin: false }),
  });

  assert.equal(userId, "user-1");
});

test("resolveClientJwt rejects tampered, expired and unknown clients", async () => {
  const { privatePem, publicPem } = keypair();
  const token = signToken(privatePem);
  const other = keypair();

  const deps = {
    fetchCertificate: async () => ({ cert: publicPem }),
    fetchUser: async () => ({ id: "user-1", admin: false }),
  };

  assert.equal(
    await resolveClientJwt(requestWith(`JWT client-1 ${token}tampered`), deps),
    undefined,
  );
  assert.equal(
    await resolveClientJwt(
      requestWith(`JWT client-1 ${signToken(other.privatePem)}`),
      deps,
    ),
    undefined,
    "a token signed by another key must not verify",
  );
  assert.equal(
    await resolveClientJwt(
      requestWith(`JWT client-1 ${signToken(privatePem, { exp: 1 })}`),
      deps,
    ),
    undefined,
    "expired tokens must be rejected",
  );
  assert.equal(
    await resolveClientJwt(requestWith(`JWT client-1 ${token}`), {
      ...deps,
      fetchCertificate: async () => undefined,
    }),
    undefined,
    "unknown/blacklisted clients must be rejected",
  );
  assert.equal(
    await resolveClientJwt(requestWith(`JWT client-1 ${token}`), {
      ...deps,
      fetchUser: async () => undefined,
    }),
    undefined,
    "a client without a user must be rejected",
  );
  assert.equal(
    await resolveClientJwt(requestWith(`Bearer ${token}`), deps),
    undefined,
  );
});
