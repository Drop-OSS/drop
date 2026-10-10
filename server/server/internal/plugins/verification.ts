import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { PluginManifest } from "./types";
import { SIGNATURE_VERSION, signaturePayloadV2 } from "./signature";

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

/** Whether a bundle-relative path is executable plugin code. */
export function isBundleCodeFile(rel: string): boolean {
  const ext = path.extname(rel).toLowerCase();
  return ext === ".js" || ext === ".mjs" || ext === ".cjs";
}

/**
 * The bundle manifest cannot cover its own digest, so it is excluded from
 * bundle hashing. This mirrors `server/dev-tools/sign-plugin.mjs` and the
 * plugin SDK CLI.
 */
export function isIgnoredBundleFile(prefix: string, name: string): boolean {
  return prefix === "" && name === "drop-plugin.json";
}

/** True when `child` resolves inside (or equals) `parent`. */
export function isInsideDirectory(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

/** Constant-time comparison so digest checks do not leak through timing. */
export function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isSha256Hex(value: string): boolean {
  return SHA256_HEX_PATTERN.test(value);
}

/** SHA-256 of `bytes` as lowercase hex. */
export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Verify a bundle entry's declared `checksum` (if present) against its bytes
 * and return the computed digest.
 */
export function verifyEntryChecksum(
  bytes: Buffer,
  manifest: PluginManifest,
): string {
  const digest = sha256Hex(bytes);

  if (
    manifest.checksum &&
    (!isSha256Hex(manifest.checksum) ||
      !constantTimeEqual(manifest.checksum, digest))
  ) {
    throw new Error(
      `bundle checksum mismatch for ${manifest.id}: expected ${manifest.checksum}, found ${digest}`,
    );
  }
  return digest;
}

/** Recursively list bundle files, ignoring installed dependencies and the manifest. */
export async function listBundleFiles(
  root: string,
  prefix = "",
): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(path.join(root, prefix), {
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "node_modules") {
      const subPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
      results.push(...(await listBundleFiles(root, subPrefix)));
    } else if (entry.isFile() && !isIgnoredBundleFile(prefix, entry.name)) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      results.push(rel);
    }
  }
  return results.sort((a, b) => a.localeCompare(b));
}

/** SHA-256 over every bundle file, used to cache-bust the entry import. */
export async function aggregateBundleDigest(
  root: string,
  files: string[],
): Promise<string> {
  const hasher = createHash("sha256");
  for (const rel of files) {
    const bytes = await fs.readFile(path.join(root, rel));
    hasher.update(rel);
    hasher.update("\0");
    hasher.update(String(bytes.length));
    hasher.update("\0");
    hasher.update(bytes);
  }
  return hasher.digest("hex");
}

/** Verify every declared `files` entry against the bundle on disk. */
async function verifyDeclaredBundleFiles(
  root: string,
  files: string[],
  declared: Record<string, string>,
): Promise<void> {
  for (const [rel, expected] of Object.entries(declared)) {
    const resolved = path.resolve(root, rel);
    if (path.isAbsolute(rel) || !isInsideDirectory(root, resolved)) {
      throw new Error(`invalid bundle file path '${rel}'`);
    }
    if (!files.includes(rel)) {
      throw new Error(`bundle manifest lists missing file '${rel}'`);
    }
    const digest = createHash("sha256")
      .update(await fs.readFile(resolved))
      .digest("hex");
    if (!isSha256Hex(expected) || !constantTimeEqual(expected, digest)) {
      throw new Error(`bundle file checksum mismatch for ${rel}`);
    }
  }
}

/**
 * Verify every importable file in a bundle and return an aggregate digest
 * used to cache-bust the entry import.
 *
 * A bundle with more than one code file must declare `files` checksums; a
 * single-file bundle may rely on the entry `checksum`. Values in `files`
 * must match and cover every code file, so relative imports cannot smuggle
 * unverified modules into the process.
 */
export async function verifyBundleFiles(
  pluginDir: string,
  manifest: PluginManifest,
): Promise<string> {
  const root = path.resolve(pluginDir);
  const files = await listBundleFiles(root);
  const codeFiles = files.filter(isBundleCodeFile);

  if (manifest.files) {
    await verifyDeclaredBundleFiles(root, files, manifest.files);
    for (const rel of codeFiles) {
      if (!(rel in manifest.files)) {
        throw new Error(
          `bundle file '${rel}' is not covered by the manifest 'files' checksums`,
        );
      }
    }
  } else if (codeFiles.length > 1) {
    throw new Error(
      `bundle '${manifest.id}' contains multiple code files but no 'files' checksums; refusing unverified imports`,
    );
  }

  return await aggregateBundleDigest(root, files);
}

/**
 * Reconstruct the payload a bundle signature covers. Signature v2 covers the
 * canonical manifest in addition to the file aggregate; legacy bundles (no
 * marker) cover the file aggregate, or the entry checksum for single-file
 * bundles.
 */
export function resolveSignedPayload(
  aggregateDigest: string,
  entryDigest: string,
  manifest: PluginManifest,
): string {
  if (manifest.signatureVersion === SIGNATURE_VERSION) {
    if (!manifest.files) {
      throw new Error(
        `bundle ${manifest.id} declares signatureVersion ${SIGNATURE_VERSION} without file checksums`,
      );
    }
    return signaturePayloadV2(
      aggregateDigest,
      manifest as unknown as Record<string, unknown>,
    );
  }
  if (manifest.signatureVersion !== undefined) {
    throw new Error(
      `bundle ${manifest.id} uses unsupported signatureVersion ${manifest.signatureVersion}`,
    );
  }
  return manifest.files ? aggregateDigest : entryDigest;
}

/**
 * Verify the bundle signature. When `files` is present the signature covers
 * the aggregate bundle digest; otherwise it covers the entry checksum
 * (legacy single-file bundles). `DROP_PLUGIN_REQUIRE_SIGNATURE=true` refuses
 * unsigned bundles.
 */
export function verifyBundleSignature(
  aggregateDigest: string,
  entryDigest: string,
  manifest: PluginManifest,
): void {
  const signingKey = process.env.DROP_PLUGIN_SIGNING_KEY;
  if (manifest.signature) {
    if (!signingKey) {
      throw new Error(
        `bundle ${manifest.id} is signed but DROP_PLUGIN_SIGNING_KEY is not set`,
      );
    }
    const covered = resolveSignedPayload(
      aggregateDigest,
      entryDigest,
      manifest,
    );
    const expected = createHmac("sha256", signingKey)
      .update(covered)
      .digest("hex");
    if (
      !isSha256Hex(manifest.signature) ||
      !constantTimeEqual(expected, manifest.signature)
    ) {
      throw new Error(`bundle signature mismatch for ${manifest.id}`);
    }
  } else if (process.env.DROP_PLUGIN_REQUIRE_SIGNATURE === "true") {
    throw new Error(`bundle ${manifest.id} is unsigned`);
  }
}
