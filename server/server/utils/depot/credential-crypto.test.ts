import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { isSealed, openSecret, sealSecret } from "./credential-crypto";

const KEY_ENV = "GAMEDEPOT_CREDENTIAL_KEY";
const KEY_HEX = randomBytes(32).toString("hex");

afterEach(() => {
  delete process.env.GAMEDEPOT_CREDENTIAL_KEY;
});

test("seal/open round-trips a token and never stores plaintext", () => {
  process.env[KEY_ENV] = KEY_HEX;
  const sealed = sealSecret("Bearer eyJhbGciOi.deadbeef");
  assert.ok(sealed);
  assert.ok(isSealed(sealed));
  assert.ok(!sealed.includes("deadbeef"), "plaintext must not appear sealed");
  assert.equal(openSecret(sealed), "Bearer eyJhbGciOi.deadbeef");
});

test("a fresh IV makes each seal of the same secret different", () => {
  process.env[KEY_ENV] = KEY_HEX;
  assert.notEqual(sealSecret("same"), sealSecret("same"));
});

test("null seals and opens as null", () => {
  assert.equal(sealSecret(null), null);
  assert.equal(openSecret(null), null);
});

test("legacy plaintext rows read through untouched", () => {
  process.env[KEY_ENV] = KEY_HEX;
  assert.equal(openSecret("old-plaintext-token"), "old-plaintext-token");
  assert.equal(openSecret("enc:other:thing"), "enc:other:thing");
});

test("writes fail closed without a key instead of storing plaintext", () => {
  assert.throws(
    () => sealSecret("secret"),
    (error: unknown) =>
      (error as { statusCode?: number }).statusCode === 500 &&
      /GAMEDEPOT_CREDENTIAL_KEY/.test(
        (error as { statusMessage?: string }).statusMessage ?? "",
      ),
  );
});

test("sealed rows cannot be read without the key", () => {
  process.env[KEY_ENV] = KEY_HEX;
  const sealed = sealSecret("secret") as string;
  delete process.env.GAMEDEPOT_CREDENTIAL_KEY;
  assert.throws(
    () => openSecret(sealed),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 500,
  );
});

test("rotating the key surfaces a clear error, never garbage", () => {
  process.env[KEY_ENV] = KEY_HEX;
  const sealed = sealSecret("secret") as string;
  process.env[KEY_ENV] = randomBytes(32).toString("hex");
  assert.throws(
    () => openSecret(sealed),
    (error: unknown) =>
      /could not be decrypted/.test(
        (error as { statusMessage?: string }).statusMessage ?? "",
      ),
  );
});

test("tampered ciphertext is rejected by the auth tag", () => {
  process.env[KEY_ENV] = KEY_HEX;
  const sealed = sealSecret("secret") as string;
  const parts = sealed.split(":");
  const bytes = Buffer.from(parts[4], "base64");
  bytes[0] ^= 0xff;
  parts[4] = bytes.toString("base64");
  assert.throws(() => openSecret(parts.join(":")));
});

test("base64 keys are accepted, malformed keys are refused", () => {
  process.env[KEY_ENV] = Buffer.from(KEY_HEX, "hex").toString("base64");
  assert.equal(openSecret(sealSecret("x") as string), "x");
  process.env[KEY_ENV] = "not-a-32-byte-key";
  assert.throws(
    () => sealSecret("x"),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 500,
  );
});
