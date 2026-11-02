import { createHash } from "node:crypto";
import { canonicalize } from "json-canonicalize";

/**
 * One file inside a save snapshot. `key` is the portable archive key (the
 * Ludusavi template tail after its last placeholder), so the same logical file
 * hashes identically on Windows, Linux and Proton.
 */
export type ContentFile = {
  key: string;
  size: number;
  sha256: string;
  mode?: number;
};

/**
 * Stable identity for a save's content. Sort by key (byte-wise, not locale),
 * keep only portable fields and hash canonical JSON. Archive framing, mtimes,
 * uids and compression must never affect this value.
 */
export function contentHash(files: ContentFile[]): string {
  const normalized = files
    .map((file) => ({
      key: file.key,
      size: file.size,
      sha256: file.sha256.toLowerCase(),
      mode: file.mode ?? 0,
    }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  return createHash("sha256").update(canonicalize(normalized)).digest("hex");
}

export function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}
