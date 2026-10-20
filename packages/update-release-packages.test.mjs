import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "drop-release-packages-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of [
    "update-release-packages.mjs",
    "drop-oss-app",
    "drop-oss-app-bin",
    "flatpak",
  ]) {
    await cp(new URL(name, import.meta.url), join(dir, name), { recursive: true });
  }
  const amd64 = join(dir, "amd64.deb");
  const arm64 = join(dir, "arm64.deb");
  await writeFile(amd64, "amd64 binary");
  await writeFile(arm64, "arm64 binary");
  return { dir, amd64, arm64 };
}

test("prepares architecture-specific Flatpak sources and preserves AMD64 AUR packages", async (t) => {
  const { dir, amd64, arm64 } = await fixture(t);
  const tag = "v0.4.0-test-flatpak-1";
  const result = spawnSync(process.execPath, [
    join(dir, "update-release-packages.mjs"), tag, "0.4.0", amd64, arm64,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);

  const manifest = JSON.parse(await readFile(join(dir, "flatpak/org.droposs.client.json"), "utf8"));
  const module = manifest.modules[0];
  assert.equal(module["only-arches"], undefined);
  assert.equal(module.sources.length, 2);
  for (const [arch, debArch, contents] of [
    ["x86_64", "amd64", "amd64 binary"],
    ["aarch64", "arm64", "arm64 binary"],
  ]) {
    const sources = module.sources.filter((source) => source["only-arches"].includes(arch));
    assert.equal(sources.length, 1);
    assert.equal(sources[0].url,
      `https://github.com/Drop-OSS/drop/releases/download/${tag}/Drop.Desktop.Client_0.4.0_${debArch}.deb`);
    assert.equal(sources[0].sha256, createHash("sha256").update(contents).digest("hex"));
    assert.equal(sources[0]["dest-filename"], "drop.deb");
  }
  for (const name of ["PKGBUILD", ".SRCINFO"]) {
    const text = await readFile(join(dir, "drop-oss-app-bin", name), "utf8");
    assert.ok(text.includes(`/${tag}/Drop.Desktop.Client_0.4.0_amd64.deb`));
    assert.ok(text.includes(createHash("sha256").update("amd64 binary").digest("hex")));
    assert.ok(!text.includes("DROP_"));
  }
});

test("requires an ARM64 asset before modifying any templates", async (t) => {
  const { dir, amd64 } = await fixture(t);
  for (const args of [[], [join(dir, "missing.deb")]]) {
    const result = spawnSync(process.execPath, [
      join(dir, "update-release-packages.mjs"), "v0.4.0", "0.4.0", amd64, ...args,
    ], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, args.length ? /ENOENT/ : /ARM64_DEB_PATH/);
    assert.match(await readFile(join(dir, "drop-oss-app/PKGBUILD"), "utf8"), /DROP_PKG_VER/);
  }
});
