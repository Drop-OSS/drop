import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createError } from "h3";

/**
 * At-rest encryption for stored store credentials: OAuth access/refresh
 * tokens, Ubisoft tickets and EA session cookies all live in the
 * StoreConnection table and must never sit in the database as plaintext.
 *
 * AES-256-GCM under a deployment key supplied as GAMEDEPOT_CREDENTIAL_KEY
 * (64 hex characters or base64 of 32 bytes; `openssl rand -hex 32`).
 * Sealed values are stored as `enc:v1:<iv>:<tag>:<ciphertext>` (base64).
 *
 * Reads pass unprefixed values through untouched, so rows written before
 * encryption existed keep working; the next token write re-seals them.
 * Writes fail closed: without a key, nothing new is stored in plaintext.
 */

const SEAL_PREFIX = "enc:v1:";
const KEY_ENV = "GAMEDEPOT_CREDENTIAL_KEY";

export function isSealed(value: string): boolean {
  return value.startsWith(SEAL_PREFIX);
}

function credentialKey(): Buffer | null {
  const raw = process.env[KEY_ENV]?.trim();
  if (!raw) return null;
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, "hex");
  else {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length !== 32 || decoded.toString("base64") !== raw)
      throw createError({
        statusCode: 500,
        statusMessage:
          "GAMEDEPOT_CREDENTIAL_KEY must be 32 bytes as hex or standard base64 (openssl rand -hex 32)",
      });
    key = decoded;
  }
  return key;
}

/** Encrypt a credential for storage. Null stays null; never returns plaintext. */
export function sealSecret(plain: string | null): string | null {
  if (plain === null) return null;
  const key = credentialKey();
  if (!key)
    throw createError({
      statusCode: 500,
      statusMessage: `Store credentials cannot be saved without ${KEY_ENV}; set it in the deployment environment`,
    });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return `${SEAL_PREFIX}${iv.toString("base64")}:${cipher
    .getAuthTag()
    .toString("base64")}:${ciphertext.toString("base64")}`;
}

/** Decrypt a stored credential. Legacy plaintext values read through. */
export function openSecret(stored: string | null): string | null {
  if (stored === null || !isSealed(stored)) return stored;
  const parts = stored.slice(SEAL_PREFIX.length).split(":");
  let key: Buffer | null;
  try {
    key = credentialKey();
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: `${KEY_ENV} is not a usable key; stored credentials cannot be read`,
    });
  }
  if (!key)
    throw createError({
      statusCode: 500,
      statusMessage: `Stored credentials are encrypted but ${KEY_ENV} is not set`,
    });
  try {
    const [iv, tag, ciphertext] = parts.map((part) =>
      Buffer.from(part, "base64"),
    );
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage:
        "A stored credential could not be decrypted - the key changed or the value is corrupt",
    });
  }
}
