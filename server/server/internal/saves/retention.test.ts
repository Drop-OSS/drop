import { test } from "node:test";
import assert from "node:assert/strict";
import { selectVersionsToPrune, type RetentionCandidate } from "./retention";

const version = (
  id: string,
  minutesAgo: number,
  pinned = false,
): RetentionCandidate => ({
  id,
  pinned,
  objectId: `obj-${id}`,
  createdAt: new Date(Date.UTC(2026, 10, 3, 0, 0, 0) - minutesAgo * 60_000),
});

// Newest first unless stated otherwise.
const chain = [version("v3", 0), version("v2", 10), version("v1", 20)];

test("keeps the newest versions and prunes the oldest", () => {
  assert.deepEqual(selectVersionsToPrune(chain, 2, "v3"), ["v1"]);
});

test("input order does not matter", () => {
  const shuffled = [chain[1], chain[2], chain[0]];
  assert.deepEqual(selectVersionsToPrune(shuffled, 2, "v3"), ["v1"]);
});

test("never prunes the head even when it is the oldest", () => {
  assert.deepEqual(selectVersionsToPrune(chain, 2, "v1"), []);
  assert.deepEqual(selectVersionsToPrune(chain, 1, "v1"), ["v2"]);
});

test("never prunes pinned versions", () => {
  const pinned = [version("v3", 0), version("v2", 10, true), version("v1", 20)];
  assert.deepEqual(selectVersionsToPrune(pinned, 1, "v3"), ["v1"]);
});

test("keeps at least one version", () => {
  assert.deepEqual(selectVersionsToPrune(chain, 0, "v3"), ["v2", "v1"]);
});

test("prunes nothing when within the limit", () => {
  assert.deepEqual(selectVersionsToPrune(chain, 5, "v3"), []);
});

test("handles a slot with no head yet", () => {
  assert.deepEqual(selectVersionsToPrune(chain, 1, null), ["v2", "v1"]);
});

test("keeps head and pinned on top of the limit", () => {
  const many = [
    version("v5", 0),
    version("v4", 5),
    version("v3", 10, true),
    version("v2", 15),
    version("v1", 20),
  ];
  // keep=1 -> v5, plus pinned v3, plus head v2.
  assert.deepEqual(selectVersionsToPrune(many, 1, "v2"), ["v4", "v1"]);
});
