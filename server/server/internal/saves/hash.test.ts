import { test } from "node:test";
import assert from "node:assert/strict";
import { contentHash, isSha256, type ContentFile } from "./hash";

const file = (over: Partial<ContentFile>): ContentFile => ({
  key: "save/game.sav",
  size: 10,
  sha256: "a".repeat(64),
  ...over,
});

test("contentHash is stable regardless of input order", () => {
  const a = [
    file({ key: "save/b.sav", sha256: "b".repeat(64) }),
    file({ key: "save/a.sav", sha256: "a".repeat(64) }),
  ];
  const b = [
    file({ key: "save/a.sav", sha256: "a".repeat(64) }),
    file({ key: "save/b.sav", sha256: "b".repeat(64) }),
  ];
  assert.equal(contentHash(a), contentHash(b));
});

test("contentHash ignores hash letter case", () => {
  const lower = [file({ sha256: "ab".repeat(32) })];
  const upper = [file({ sha256: "AB".repeat(32) })];
  assert.equal(contentHash(lower), contentHash(upper));
});

test("contentHash separates an empty save from any file", () => {
  assert.notEqual(contentHash([]), contentHash([file({})]));
});

test("contentHash tracks size and mode but defaults a missing mode to 0", () => {
  assert.notEqual(
    contentHash([file({ size: 10 })]),
    contentHash([file({ size: 11 })]),
  );
  assert.notEqual(
    contentHash([file({ mode: 0o644 })]),
    contentHash([file({ mode: 0o755 })]),
  );
  assert.equal(contentHash([file({})]), contentHash([file({ mode: 0 })]));
});

test("contentHash tracks every file, so an extra byte changes it", () => {
  const before = [file({ key: "s/1" }), file({ key: "s/2" })];
  const after = [file({ key: "s/1" }), file({ key: "s/2", size: 11 })];
  assert.notEqual(contentHash(before), contentHash(after));
});

test("contentHash is a SHA-256 hex digest", () => {
  assert.match(contentHash([file({})]), /^[a-f0-9]{64}$/);
});

test("isSha256 accepts only 64 hex characters", () => {
  assert.equal(isSha256("0".repeat(64)), true);
  assert.equal(isSha256("A".repeat(64)), true);
  assert.equal(isSha256("0".repeat(63)), false);
  assert.equal(isSha256("g".repeat(64)), false);
  assert.equal(isSha256(""), false);
});
