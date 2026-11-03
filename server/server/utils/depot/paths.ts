import { join } from "node:path";

/** A content digest is what the manifest addresses chunks with, and what the
 *  client asks the server for — so it is also a path-safety boundary. */
const CONTENT_DIGEST = /^[0-9a-f]{64}$/;

export function isContentDigest(value: string): boolean {
  return CONTENT_DIGEST.test(value);
}

/**
 * Root of the content-addressed depot: `objects/<first-two-hex>/<sha256>`
 * chunk objects plus `manifests/<digest>.json` manifests, the layout
 * `chunkFileToCas` writes. It sits inside the server's own data folder, next to
 * the object store, so a backup of that folder covers the library bytes too.
 */
export function depotRootFor(dataFolder: string): string {
  return join(dataFolder, "depot");
}

/** Where a chunk object lives. The caller has to have validated the digest. */
export function casObjectPath(root: string, sha256: string): string {
  if (!isContentDigest(sha256)) throw new Error("Not a content digest");
  return join(root, "objects", sha256.slice(0, 2), sha256);
}

export function casManifestPath(root: string, digest: string): string {
  if (!isContentDigest(digest)) throw new Error("Not a manifest digest");
  return join(root, "manifests", `${digest}.json`);
}
