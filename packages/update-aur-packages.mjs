import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function replaceToken(text, token, value, expectedCount) {
  const actualCount = text.split(token).length - 1;
  if (actualCount !== expectedCount) {
    throw new Error(`Expected ${expectedCount} ${token} tokens, found ${actualCount}`);
  }
  return text.replaceAll(token, value);
}

async function updateFile(path, transform) {
  const original = await readFile(path, "utf8");
  await writeFile(path, transform(original));
}

const [tag, version, debPath, ...extraArgs] = process.argv.slice(2);
if (!tag || !version || !debPath || extraArgs.length > 0) {
  throw new Error("usage: update-aur-packages.mjs TAG VERSION DEB_PATH");
}
if (!/^[A-Za-z0-9._-]+$/.test(tag)) {
  throw new Error("Release tag contains unsupported characters");
}
if (!/^[0-9]+(?:\.[0-9]+)*$/.test(version)) {
  throw new Error("Package version must contain numeric dot-separated components");
}

const packagesDir = dirname(fileURLToPath(import.meta.url));
const checksum = createHash("sha256").update(await readFile(debPath)).digest("hex");
const tokens = [
  ["DROP_PKG_VER", version],
  ["DROP_PKG_REL", "1"],
  ["DROP_RELEASE_TAG", tag],
  ["DROP_DEB_SHA256", checksum],
];
const files = [
  { packageName: "drop-oss-app", fileName: "PKGBUILD", tokenCounts: [2, 1, 1, 0] },
  { packageName: "drop-oss-app", fileName: ".SRCINFO", tokenCounts: [1, 1, 1, 0] },
  { packageName: "drop-oss-app-bin", fileName: "PKGBUILD", tokenCounts: [2, 1, 1, 1] },
  { packageName: "drop-oss-app-bin", fileName: ".SRCINFO", tokenCounts: [2, 1, 1, 1] },
  { packageName: "flatpak", fileName: "org.droposs.client.json", tokenCounts: [1, 0, 1, 1] },
];

for (const { packageName, fileName, tokenCounts } of files) {
  await updateFile(join(packagesDir, packageName, fileName), (text) =>
    tokens.reduce(
      (updated, [token, value], index) => replaceToken(updated, token, value, tokenCounts[index]),
      text,
    ),
  );
}