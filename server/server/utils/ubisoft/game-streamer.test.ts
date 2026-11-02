import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync, gzipSync } from "node:zlib";
import * as zlib from "node:zlib";
import { mkdtemp, open, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  decompressSliceBody,
  slicePathFallbacks,
  writeSliceAt,
} from "./game-streamer";
import { sha1Hex, sliceCdnPath } from "./manifest";

const zstdCompressSync = (
  zlib as unknown as Record<string, ((b: Buffer) => Buffer) | undefined>
).zstdCompressSync;

const payload = Buffer.from("ubisoft slice content ".repeat(64));

test("decompressSliceBody inflates zlib-framed slices", () => {
  assert.deepEqual(
    decompressSliceBody(Buffer.from(deflateSync(payload))),
    payload,
  );
});

test("decompressSliceBody inflates gzip-framed slices", () => {
  assert.deepEqual(
    decompressSliceBody(Buffer.from(gzipSync(payload))),
    payload,
  );
});

test("decompressSliceBody inflates zstd slices when the runtime supports it", (t) => {
  if (!zstdCompressSync) return t.skip("node without zstd");
  assert.deepEqual(
    decompressSliceBody(Buffer.from(zstdCompressSync(payload))),
    payload,
  );
});

test("decompressSliceBody passes unrecognised bytes through untouched", () => {
  const raw = Buffer.from("plain stored slice bytes, no magic");
  assert.deepEqual(decompressSliceBody(raw), raw);
  // A lone 0x78 first byte must not trigger the zlib path unless it inflates.
  const leading = Buffer.concat([
    Buffer.from([0x78]),
    Buffer.from("not-deflate"),
  ]);
  assert.deepEqual(decompressSliceBody(leading), leading);
});

test("slicePathFallbacks walks directories from the hash inside the planned path", () => {
  // Live ShootMania ingest crash (Nov 2026): acquireSlice handed the full
  // slices_v3/<char>/<HASH> path to the hash-based candidate builder and
  // every fetch died on a hex decode of "sl". A planned path must produce
  // its own path first, then sibling directories for the same hash.
  const hash = sha1Hex(Buffer.from("shootmania-slice"));
  const planned = sliceCdnPath(hash);
  const fallbacks = slicePathFallbacks(planned);
  assert.equal(fallbacks.length, 4);
  assert.equal(fallbacks[0], planned);
  for (const path of fallbacks) {
    assert.match(path, /^slices_v3\/[0-9a-v]\/[0-9A-F]{40}$/);
    assert.ok(path.endsWith(`/${hash}`));
  }
  assert.equal(new Set(fallbacks).size, 4);
});

test("slicePathFallbacks normalises a lowercase planned path", () => {
  const hash = sha1Hex(Buffer.from("mixed case"));
  const planned = sliceCdnPath(hash).toLowerCase();
  const fallbacks = slicePathFallbacks(planned);
  assert.equal(fallbacks.length, 4);
  // Candidates are built upper-case, like every CDN request Ubisoft answers.
  assert.equal(fallbacks[0], sliceCdnPath(hash));
});

test("writeSliceAt lands slices at their file offsets, not buffer offsets", async () => {
  // Live ShootMania ingest failure (Nov 2026, after the CDN-path fix):
  // FileHandle.write's second argument is the BUFFER offset, so the
  // 2-argument call threw ERR_OUT_OF_RANGE once fileOffset passed one
  // slice length (must be <= 3145728, received 28311552).
  const dir = await mkdtemp(join(tmpdir(), "ubi-write-"));
  try {
    const handle = await open(join(dir, "game.dat"), "w");
    try {
      await handle.truncate(12);
      await writeSliceAt(handle, Buffer.from("AAAA"), 0);
      await writeSliceAt(handle, Buffer.from("BBBB"), 4);
      await writeSliceAt(handle, Buffer.from("CCCC"), 8);
    } finally {
      await handle.close();
    }
    const assembled = await readFile(join(dir, "game.dat"));
    assert.equal(assembled.length, 12);
    assert.equal(assembled.toString(), "AAAABBBBCCCC");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
