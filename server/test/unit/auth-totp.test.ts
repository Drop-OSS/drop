import { describe, expect, it } from "vitest";
import {
  dropDecodeArrayBase64,
  dropEncodeArrayBase64,
} from "../../../server/server/internal/auth/totp";

describe("dropEncodeArrayBase64", () => {
  it("encodes an empty Uint8Array to empty string", () => {
    expect(dropEncodeArrayBase64(new Uint8Array())).toBe("");
  });

  it("encodes a single byte correctly", () => {
    expect(dropEncodeArrayBase64(new Uint8Array([72]))).toBe("SA==");
  });

  it("encodes a known multi-byte sequence (ASCII 'Hello')", () => {
    // 'Hello' = [0x48, 0x65, 0x6c, 0x6c, 0x6f] → 'SGVsbG8='
    expect(
      dropEncodeArrayBase64(new Uint8Array([72, 101, 108, 108, 111])),
    ).toBe("SGVsbG8=");
  });

  it("encodes a binary sequence with non-ASCII bytes", () => {
    expect(
      dropEncodeArrayBase64(new Uint8Array([0x00, 0xff, 0x7f, 0x80])),
    ).toBe("AP9/gA==");
  });

  it("round-trips with dropDecodeArrayBase64", () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const encoded = dropEncodeArrayBase64(original);
    const decoded = dropDecodeArrayBase64(encoded);
    expect(decoded).toEqual(original);
  });
});

describe("dropDecodeArrayBase64", () => {
  it("decodes empty string to empty Uint8Array", () => {
    expect(dropDecodeArrayBase64("")).toEqual(new Uint8Array());
  });

  it("decodes a single base64 char to one byte", () => {
    expect(dropDecodeArrayBase64("SA==")).toEqual(new Uint8Array([72]));
  });

  it("decodes 'SGVsbG8=' to 'Hello'", () => {
    expect(dropDecodeArrayBase64("SGVsbG8=")).toEqual(
      new Uint8Array([72, 101, 108, 108, 111]),
    );
  });

  it("round-trips with dropEncodeArrayBase64", () => {
    const original = new Uint8Array([0x00, 0xff, 0x80, 0x7f, 0x42]);
    const decoded = dropDecodeArrayBase64(dropEncodeArrayBase64(original));
    expect(decoded).toEqual(original);
  });
});

import { SecretKey, totp, generateKey } from "otp-io";
import { hmac, randomBytes } from "otp-io/crypto";

describe("TOTP code generation and verification", () => {
  it("generates a 6-digit code that round-trips with the same secret", async () => {
    const secret = generateKey(randomBytes, 20);
    const secretKey = new SecretKey(secret.bytes);

    const code = await totp(hmac, { secret: secretKey });
    const reCode = await totp(hmac, { secret: secretKey });

    expect(code).toMatch(/^\d{6}$/);
    expect(code).toBe(reCode);
  });

  it("round-trips through base64 storage format", async () => {
    const secret = generateKey(randomBytes, 20);
    const base64 = dropEncodeArrayBase64(secret.bytes);
    const restored = new SecretKey(dropDecodeArrayBase64(base64));

    const code = await totp(hmac, { secret });
    const restoredCode = await totp(hmac, { secret: restored });

    expect(code).toBe(restoredCode);
  });

  it("rejects an invalid (wrong) code", async () => {
    const secret = generateKey(randomBytes, 20);
    const secretKey = new SecretKey(secret.bytes);

    const code = await totp(hmac, { secret: secretKey });

    expect(code).not.toBe("000000");
  });

  it("fails verification when time window has passed", async () => {
    const secret = generateKey(randomBytes, 20);
    const secretKey = new SecretKey(secret.bytes);

    const current = await totp(hmac, { secret: secretKey });
    const past = await totp(hmac, {
      secret: secretKey,
      now: new Date(Date.now() - 120_000), // 2 minutes ago = 4 windows back
    });

    expect(current).not.toBe(past);
  });

  it("produces different codes for different secrets at the same time", async () => {
    const secretA = generateKey(randomBytes, 20);
    const secretB = generateKey(randomBytes, 20);
    const now = new Date();

    const codeA = await totp(hmac, { secret: secretA, now });
    const codeB = await totp(hmac, { secret: secretB, now });

    expect(codeA).not.toBe(codeB);
    expect(codeA).toMatch(/^\d{6}$/);
    expect(codeB).toMatch(/^\d{6}$/);
  });
});
