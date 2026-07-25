import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock systemConfig BEFORE any imports — the real singleton calls
// useRuntimeConfig() at module load time, which fails in Nuxt test env.
// ---------------------------------------------------------------------------
vi.mock("../../../server/internal/config/sys-conf", () => ({
  systemConfig: {
    getExternalUrl: () => "http://localhost:3000",
    getLibraryFolder: () => "./.data/library",
    getDataFolder: () => "./.data/data",
    getMetadataTimeout: () => 5000,
    getDropVersion: () => "0.0.0-test",
    getGitRef: () => "test",
    shouldCheckForUpdates: () => false,
    shouldOidcRequireHttps: () => false,
  },
}));

import { createHash } from "node:crypto";
import { encode } from "cbor2";
import { dropEncodeArrayBase64 } from "../../../server/internal/auth/totp";

// ---------------------------------------------------------------------------
// We import the function under test — and its helper for dynamic rpId.
// parseAndValidatePasskeyCreation validates challenge+RPID but does NOT
// validate the attestation signature (fmt field unenforced, no verificationData
// or signature checked).  These tests demonstrate the gap.
// ---------------------------------------------------------------------------
import {
  parseAndValidatePasskeyCreation,
  getRpId,
} from "../../../server/internal/auth/webauthn";

// ===========================================================================
// Helpers
// ===========================================================================

const CHALLENGE = "test-challenge-value";

/** Base64-encode a string the way the WebAuthn client-data challenge would be. */
function b64encode(raw: string): string {
  return Buffer.from(raw).toString("base64");
}

/**
 * Build a valid-looking clientData JSON string and base64-encode it the way
 * the WebAuthn ceremony does (UTF-8 → base64url → the function decodes via
 * dropDecodeArrayBase64 which is plain base64).
 */
function buildClientData(challenge: string): string {
  const json = JSON.stringify({
    type: "webauthn.create",
    challenge: b64encode(challenge),
    origin: "http://localhost",
  });
  return dropEncodeArrayBase64(new TextEncoder().encode(json));
}

/**
 * Build a CBOR attestation object with the given fmt and authData.
 * The authData **must** contain a valid RPID hash for "localhost"
 * since parseAndValidatePasskeyCreation checks rpIdHash.
 */
function buildAttestationObject(
  authData: Uint8Array | Buffer,
  fmt = "none",
): Uint8Array {
  const map = new Map<string, string | Uint8Array>();
  map.set("fmt", fmt);
  map.set("authData", new Uint8Array(authData));
  return encode(map);
}

/**
 * Build valid authData bytes:
 *   [0..31]  RPID hash  (SHA-256 of "localhost")
 *   [32]     flags      (0x41 = UP + AT)
 *   [33..36] counter    (0x00000000)
 *   [37..52] AAGUID     (16 zero bytes)
 *   [53..54] credential ID length (big-endian)
 *   [55..]   credential ID + CBOR-encoded COSE public key
 *
 * The COSE key is an arbitrary EC2 P-256 key (the test only cares that the
 * structure is valid; the key itself is never verified against any issuer).
 */
function buildAuthData(): Buffer {
  // 1. RPID hash for "localhost"
  const rpIdHash = createHash("sha256").update("localhost").digest();

  // 2. Flags + counter
  const flags = Buffer.from([0x41]);
  const counter = Buffer.alloc(4, 0);

  // 3. AAGUID (16 zero bytes)
  const aaguid = Buffer.alloc(16, 0);

  // 4. Craft a structurally valid COSE EC2 P-256 key
  //    (arbitrary coordinates; no authenticator ever signed them)
  const coseKey = new Map<number, number | Buffer>([
    [1, 2], //  kty = EC2
    [3, -7], // alg = ES256
    [-1, 1], // crv = P-256
    [
      -2,
      Buffer.from([
        0xe7, 0x64, 0xeb, 0xad, 0x3b, 0xf0, 0x03, 0x87, 0x46, 0x99, 0xb7, 0xc5,
        0x41, 0xce, 0x94, 0x79, 0x6a, 0x17, 0xac, 0xd6, 0x53, 0xeb, 0x58, 0x28,
        0xba, 0x2f, 0x40, 0xa3, 0xe3, 0x4b, 0xf7, 0xdb,
      ]),
    ],
    [
      -3,
      Buffer.from([
        0x93, 0xc3, 0xdf, 0xd7, 0x10, 0xee, 0x2c, 0xb4, 0x43, 0x4e, 0x27, 0xd5,
        0x42, 0x50, 0x2e, 0x82, 0xef, 0x5f, 0x2c, 0xa0, 0xef, 0xe8, 0xde, 0xd8,
        0x1d, 0xce, 0x9d, 0xad, 0xbc, 0x1a, 0x40, 0x2c,
      ]),
    ],
  ]);

  // CBOR-encode the COSE key so we know its length
  const coseKeyRaw = Buffer.from(encode(coseKey));

  // Use a 16-byte credential ID
  const credentialId = Buffer.alloc(16, 0xab);

  // Credential ID length as big-endian u16
  const credIdLenBuf = Buffer.alloc(2);
  credIdLenBuf.writeUInt16BE(credentialId.length);

  // Assemble the authData
  return Buffer.concat([
    rpIdHash,
    flags,
    counter,
    aaguid,
    credIdLenBuf,
    credentialId,
    coseKeyRaw,
  ]);
}

// ===========================================================================
// Tests
// ===========================================================================

describe("parseAndValidatePasskeyCreation", () => {
  // -----------------------------------------------------------------------
  // Gap demonstration: attestation signature is NOT validated
  // -----------------------------------------------------------------------
  it("accepts crafted CBOR with an arbitrary public key (attestation NOT validated)", async () => {
    const clientData = buildClientData(CHALLENGE);
    const authData = buildAuthData();
    const attestationObject = buildAttestationObject(authData);

    const attestationString = dropEncodeArrayBase64(attestationObject);

    // The function should return successfully even though the "attestation"
    // is completely fabricated — no authenticator created it, no signature
    // is present, and the fmt "none" explicitly means no attestation.
    const result = await parseAndValidatePasskeyCreation(
      clientData,
      attestationString,
      CHALLENGE,
    );

    expect(result).toBeDefined();
    expect(result.credentialIdStr).toBe(Buffer.alloc(16, 0xab).toString("hex"));
    expect(result.jwk).toBeDefined();
    expect(result.jwk.kty).toBe("EC");
    expect(result.jwk.alg).toBe("ES256");
  });

  // -----------------------------------------------------------------------
  // Challenge validation still works
  // -----------------------------------------------------------------------
  it("rejects a mismatched challenge", async () => {
    const clientData = buildClientData(CHALLENGE);
    const authData = buildAuthData();
    const attestationObject = buildAttestationObject(authData);
    const attestationString = dropEncodeArrayBase64(attestationObject);

    await expect(
      parseAndValidatePasskeyCreation(
        clientData,
        attestationString,
        "wrong-challenge-value",
      ),
    ).rejects.toThrow(/challenge/i);
  });

  // -----------------------------------------------------------------------
  // Structural validation rejects broken input
  // -----------------------------------------------------------------------
  it("rejects invalid client data JSON", async () => {
    // Base64-encode garbage that isn't JSON
    const garbage = dropEncodeArrayBase64(new TextEncoder().encode("not-json"));

    const authData = buildAuthData();
    const attestationObject = buildAttestationObject(authData);
    const attestationString = dropEncodeArrayBase64(attestationObject);

    await expect(
      parseAndValidatePasskeyCreation(garbage, attestationString, CHALLENGE),
    ).rejects.toThrow();
  });

  it("rejects attestation object that is not valid CBOR", async () => {
    const clientData = buildClientData(CHALLENGE);
    // Pass base64 that decodes to non-CBOR bytes
    const garbage = dropEncodeArrayBase64(new Uint8Array([0, 1, 2, 3, 4]));

    await expect(
      parseAndValidatePasskeyCreation(clientData, garbage, CHALLENGE),
    ).rejects.toThrow();
  });

  // -----------------------------------------------------------------------
  // getRpId returns expected value
  // -----------------------------------------------------------------------
  it("getRpId returns localhost for default config", async () => {
    const rpId = await getRpId();
    expect(rpId).toBe("localhost");
  });
});
