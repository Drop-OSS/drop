#!/usr/bin/env node
/**
 * Sign a Drop plugin bundle.
 *
 * Reads `<bundle>/drop-plugin.json`, computes the SHA-256 of the entry file
 * (default `index.js`) into `checksum`, records a `files` map covering every
 * bundle file, and — when `DROP_PLUGIN_SIGNING_KEY` is set — writes an
 * HMAC-SHA256 `signature` (signatureVersion 2) over the file aggregate plus the
 * canonical manifest, so `id`/`version`/`capabilities` are covered too. The
 * manager verifies all of these (and refuses multi-file bundles without
 * `files`) before importing a bundle.
 *
 * Usage: node dev-tools/sign-plugin.mjs <bundle-dir>
 */
import { createHash, createHmac } from "node:crypto";
import { readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MANIFEST_FILE = "drop-plugin.json";
const SIGNING_KEY_ENV = "DROP_PLUGIN_SIGNING_KEY";

/** True when `candidate` is inside `base` (both absolute, lexically). */
function isInside(base, candidate) {
  const relative = path.relative(base, candidate);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

const rawBundleDir = process.argv[2];
if (!rawBundleDir) {
  console.error("usage: node dev-tools/sign-plugin.mjs <bundle-dir>");
  process.exit(1);
}

// Confine the caller-supplied directory to the working directory *before* any
// filesystem access. Absolute paths and `..` escapes are rejected, and the
// symlink-resolved path is re-checked so a symlink cannot escape either.
const cwd = process.cwd();
const resolvedPath = path.resolve(cwd, rawBundleDir);
if (!isInside(cwd, resolvedPath)) {
  console.error("bundle directory must be inside the working directory");
  process.exit(1);
}
const bundleDir = await realpath(resolvedPath).catch(() => null);
if (!bundleDir || !isInside(cwd, bundleDir)) {
  console.error("bundle directory must be inside the working directory");
  process.exit(1);
}
// NOSONAR: `bundleDir` is confined by the isInside checks above; the analyzer
// cannot see the sanitizer.
const bundleStat = await stat(bundleDir).catch(() => null); // NOSONAR
if (!bundleStat?.isDirectory()) {
  console.error("bundle directory must be an existing directory");
  process.exit(1);
}

/** Recursively lists bundle files as POSIX-style relative paths, sorted. */
async function listFiles(root, prefix = "") {
  const results = [];
  // `root` is the confined bundle directory validated by the caller.
  const readdirOptions = { withFileTypes: true };
  const entries = await readdir(path.join(root, prefix), readdirOptions); // NOSONAR
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      results.push(...(await listFiles(root, rel)));
    } else if (entry.isFile()) {
      // The manifest cannot checksum itself; the manager excludes it too.
      if (!prefix && entry.name === MANIFEST_FILE) continue;
      results.push(rel);
    }
  }
  return results.sort((a, b) => a.localeCompare(b));
}

const manifestPath = path.join(bundleDir, MANIFEST_FILE);
// NOSONAR: manifestPath is a fixed file name inside the confined bundleDir.
const manifest = JSON.parse(await readFile(manifestPath, "utf-8")); // NOSONAR
const entry = manifest.entry ?? "index.js";
if (typeof entry !== "string") {
  console.error("manifest entry must be a string");
  process.exit(1);
}
// A manifest must not point the entry outside the bundle (e.g.
// `"entry": "../../secret"`); check the lexical path and the symlink-resolved
// path so a symlink inside the bundle cannot escape either.
const entryPath = path.resolve(bundleDir, entry);
const entryRealPath = await realpath(entryPath).catch(() => null);
if (
  !isInside(bundleDir, entryPath) ||
  !entryRealPath ||
  !isInside(bundleDir, entryRealPath)
) {
  console.error("manifest entry must be inside the bundle directory");
  process.exit(1);
}
// NOSONAR: entryRealPath passed the confinement checks above.
const entryBytes = await readFile(entryRealPath); // NOSONAR

const checksum = createHash("sha256").update(entryBytes).digest("hex");
manifest.checksum = checksum;

const files = await listFiles(bundleDir);
const fileChecksums = {};
const aggregate = createHash("sha256");
for (const rel of files) {
  const bytes = await readFile(path.join(bundleDir, rel));
  fileChecksums[rel] = createHash("sha256").update(bytes).digest("hex");
  aggregate.update(rel);
  aggregate.update("\0");
  aggregate.update(String(bytes.length));
  aggregate.update("\0");
  aggregate.update(bytes);
}
manifest.files = fileChecksums;

/** Deterministic JSON; must stay byte-identical to the manager and the CLI. */
function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b, "en"));
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

/** Signature payload v2: file aggregate plus canonical manifest. */
function signaturePayloadV2(filesAggregate, manifest) {
  const signable = { ...manifest };
  delete signable.signature;
  return createHash("sha256")
    .update(filesAggregate)
    .update("\0")
    .update(stableStringify(signable))
    .digest("hex");
}

const key = process.env[SIGNING_KEY_ENV];
if (key) {
  manifest.signatureVersion = 2;
  const payload = signaturePayloadV2(aggregate.digest("hex"), manifest);
  manifest.signature = createHmac("sha256", key).update(payload).digest("hex");
} else {
  delete manifest.signature;
  delete manifest.signatureVersion;
  console.warn(
    `${SIGNING_KEY_ENV} not set; wrote checksums without a signature`,
  );
}

// NOSONAR: manifestPath is inside the confined bundleDir.
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`); // NOSONAR
console.log(`signed bundle: ${files.length} file(s)`);
