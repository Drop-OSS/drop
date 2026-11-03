import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishDirectoryToCas } from "./publish";
import { readDropletManifest } from "./manifest";
import { casManifestPath } from "./paths";

async function scratchDir(label: string) {
  return await mkdtemp(join(tmpdir(), `gd-cas-${label}-`));
}

async function countFiles(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, {
      recursive: true,
      withFileTypes: true,
    });
    return entries.filter((entry) => entry.isFile()).length;
  } catch {
    return 0;
  }
}

test("the same tree always publishes the same digest and reuses every chunk", async () => {
  const source = await scratchDir("source");
  const root = await scratchDir("store");
  await writeFile(join(source, "game.exe"), "first bytes");
  await mkdir(join(source, "Data", "Levels"), { recursive: true });
  await writeFile(join(source, "Data", "Levels", "level1.dat"), "level one");

  const first = await publishDirectoryToCas({
    sourceDir: source,
    depotRoot: root,
  });
  const objectsAfterFirst = await countFiles(join(root, "objects"));
  const second = await publishDirectoryToCas({
    sourceDir: source,
    depotRoot: root,
  });

  assert.equal(second.digest, first.digest, "digest is content, not time");
  assert.equal(first.fileCount, 2);
  assert.equal(
    await countFiles(join(root, "objects")),
    objectsAfterFirst,
    "a re-publish wrote no new object",
  );
  // The written file is the manifest it names, and it verifies itself.
  const manifest = await readDropletManifest(
    casManifestPath(root, first.digest),
  );
  assert.deepEqual(
    manifest.files.map((file) => file.path),
    ["Data/Levels/level1.dat", "game.exe"],
    "paths are relative, posix and ordered",
  );
  assert.equal(manifest.files[1].size, 11);
});

test("identical content across files is stored once", async () => {
  const source = await scratchDir("dupes");
  const root = await scratchDir("store");
  await writeFile(join(source, "a.dat"), "same every time");
  await writeFile(join(source, "b.dat"), "same every time");

  const result = await publishDirectoryToCas({
    sourceDir: source,
    depotRoot: root,
  });

  assert.equal(result.fileCount, 2);
  assert.equal(result.chunkCount, 1, "two files, one chunk object");
  assert.equal(await countFiles(join(root, "objects")), 1);
});

test("the executable bit is carried in the manifest", async () => {
  const source = await scratchDir("modes");
  const root = await scratchDir("store");
  await writeFile(join(source, "launcher"), "#!/bin/sh\n");
  await chmod(join(source, "launcher"), 0o755);
  await writeFile(join(source, "readme.txt"), "hello");
  await chmod(join(source, "readme.txt"), 0o644);

  const result = await publishDirectoryToCas({
    sourceDir: source,
    depotRoot: root,
  });
  const manifest = await readDropletManifest(
    casManifestPath(root, result.digest),
  );
  const byPath = Object.fromEntries(manifest.files.map((f) => [f.path, f]));

  assert.equal(
    byPath["launcher"].mode & 0o100,
    0o100,
    "launcher stays executable",
  );
  assert.equal(byPath["readme.txt"].mode, 0o644);
});

test("an empty file is a file, with no chunks to fetch", async () => {
  const source = await scratchDir("empty");
  const root = await scratchDir("store");
  await writeFile(join(source, "placeholder"), "");
  await writeFile(join(source, "real"), "bytes");

  const result = await publishDirectoryToCas({
    sourceDir: source,
    depotRoot: root,
  });
  const manifest = await readDropletManifest(
    casManifestPath(root, result.digest),
  );
  const empty = manifest.files.find((file) => file.path === "placeholder");

  assert.ok(empty, "the empty file is still in the release");
  assert.equal(empty.size, 0);
  assert.deepEqual(empty.chunks, []);
});

test("a symlink is refused rather than published", async () => {
  const source = await scratchDir("symlink");
  const root = await scratchDir("store");
  await writeFile(join(source, "real"), "bytes");
  await symlink(join(source, "real"), join(source, "link"));

  await assert.rejects(
    () => publishDirectoryToCas({ sourceDir: source, depotRoot: root }),
    /symlink/i,
  );
  assert.equal(
    await countFiles(join(root, "manifests")),
    0,
    "no manifest landed",
  );
});

test("a tree with nothing in it is refused", async () => {
  const source = await scratchDir("blank");
  const root = await scratchDir("store");
  await mkdir(join(source, "only-an-empty-folder"), { recursive: true });

  await assert.rejects(
    () => publishDirectoryToCas({ sourceDir: source, depotRoot: root }),
    /No files to publish/,
  );
});

test("a cancelled publish reports the cancellation and names no manifest", async () => {
  const source = await scratchDir("cancel");
  const root = await scratchDir("store");
  await writeFile(join(source, "real"), "bytes");
  const controller = new AbortController();
  controller.abort("stopped by the operator");

  await assert.rejects(
    () =>
      publishDirectoryToCas({
        sourceDir: source,
        depotRoot: root,
        signal: controller.signal,
      }),
    /stopped by the operator/,
  );
  assert.equal(await countFiles(join(root, "manifests")), 0);
});

test("progress runs from zero to the whole release", async () => {
  const source = await scratchDir("progress");
  const root = await scratchDir("store");
  await writeFile(join(source, "one"), "aaaa");
  await writeFile(join(source, "two"), "bbbbbb");
  const seen: Array<[number, number]> = [];

  const result = await publishDirectoryToCas({
    sourceDir: source,
    depotRoot: root,
    onProgress: (done, total) => seen.push([done, total]),
  });

  assert.equal(result.totalBytes, 10);
  assert.ok(seen.length > 0, "progress was reported");
  assert.equal(seen[0][1], 10, "the total is the whole release");
  assert.equal(seen.at(-1)?.[0], 10, "it finishes at the whole release");
  assert.deepEqual(
    await readFile(join(source, "two"), "utf8"),
    "bbbbbb",
    "the source is left untouched",
  );
});
