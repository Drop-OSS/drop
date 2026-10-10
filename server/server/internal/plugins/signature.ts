import { createHash } from "node:crypto";

/**
 * Bundle signature schemes.
 *
 * - Version 2: the HMAC covers the file aggregate plus the canonical manifest
 *   (everything except `signature`), so `id`, `version`, and `capabilities`
 *   cannot be tampered with.
 * - Legacy (no marker): the HMAC covers the file aggregate only, or the entry
 *   checksum for single-file bundles.
 */
export const SIGNATURE_VERSION = 2;

/** Deterministic JSON; must stay byte-identical to the plugin CLI's signer. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((a, b) => a.localeCompare(b, "en"));
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

/**
 * Version 2 signature payload: the files aggregate plus the canonical manifest
 * (excluding its `signature` field). Mirrors the plugin CLI's
 * `signaturePayloadV2` (`@drop-oss/plugin-cli`); a shared fixture vector in
 * both repos guards against drift.
 */
export function signaturePayloadV2(
  filesAggregate: string,
  manifest: Record<string, unknown>,
): string {
  const { signature: _ignored, ...signable } = manifest;
  return createHash("sha256")
    .update(filesAggregate)
    .update("\0")
    .update(stableStringify(signable))
    .digest("hex");
}
