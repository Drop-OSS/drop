import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync, gzipSync } from "node:zlib";
import * as zlib from "node:zlib";
import { decompressSliceBody } from "./game-streamer";

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
