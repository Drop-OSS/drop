import { test } from "node:test";
import assert from "node:assert/strict";
import { decideSync, type SyncState } from "./conflict";

const state = (over: Partial<SyncState> = {}): SyncState => ({
  baseVersionId: "b1",
  headVersionId: "b1",
  localContentHash: "local",
  baseContentHash: "local",
  headContentHash: "local",
  ...over,
});

test("a save matching the server head is converged", () => {
  assert.equal(decideSync(state()), "converged");
});

test("an untouched baseline pushes", () => {
  assert.equal(
    decideSync(state({ localContentHash: "edited", baseContentHash: "local" })),
    "push",
  );
});

test("an unchanged baseline with a moved head pulls", () => {
  assert.equal(
    decideSync(
      state({
        headVersionId: "h2",
        localContentHash: "local",
        baseContentHash: "local",
        headContentHash: "other",
      }),
    ),
    "pull",
  );
});

test("local edits plus a moved head conflict", () => {
  assert.equal(
    decideSync(
      state({
        headVersionId: "h2",
        localContentHash: "edited",
        baseContentHash: "local",
        headContentHash: "other",
      }),
    ),
    "conflict",
  );
});

test("edits that happen to match the head converge instead of conflicting", () => {
  assert.equal(
    decideSync(
      state({
        headVersionId: "h2",
        localContentHash: "other",
        baseContentHash: "local",
        headContentHash: "other",
      }),
    ),
    "converged",
  );
});

test("a fresh device with no baseline pulls", () => {
  assert.equal(
    decideSync({
      baseVersionId: null,
      headVersionId: "h1",
      localContentHash: null,
      baseContentHash: null,
      headContentHash: "remote",
    }),
    "pull",
  );
});

test("a fresh device with local saves and no remote head pushes", () => {
  assert.equal(
    decideSync({
      baseVersionId: null,
      headVersionId: null,
      localContentHash: "local",
      baseContentHash: null,
      headContentHash: null,
    }),
    "push",
  );
});

test("an empty slot with nothing local does nothing", () => {
  assert.equal(
    decideSync({
      baseVersionId: null,
      headVersionId: null,
      localContentHash: null,
      baseContentHash: null,
      headContentHash: null,
    }),
    "noop",
  );
});

test("a synced slot with unknown local content does nothing", () => {
  assert.equal(
    decideSync(state({ localContentHash: null, headContentHash: "local" })),
    "noop",
  );
});

test("diverged without a known base conflicts rather than guessing", () => {
  assert.equal(
    decideSync({
      baseVersionId: "gone",
      headVersionId: "h2",
      localContentHash: "edited",
      baseContentHash: null,
      headContentHash: "other",
    }),
    "conflict",
  );
});
