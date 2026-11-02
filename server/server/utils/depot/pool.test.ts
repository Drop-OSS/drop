import { test } from "node:test";
import assert from "node:assert/strict";
import { forEachPooled } from "./pool";

const tick = () => new Promise((wake) => setImmediate(wake));

test("forEachPooled never exceeds the requested width", async () => {
  let inFlight = 0;
  let maxSeen = 0;
  const items = Array.from({ length: 25 }, (_, i) => i);
  await forEachPooled(items, 4, undefined, "aborted", async () => {
    inFlight += 1;
    maxSeen = Math.max(maxSeen, inFlight);
    await tick();
    inFlight -= 1;
  });
  assert.ok(maxSeen <= 4, `observed ${maxSeen} concurrent runs`);
  assert.ok(maxSeen > 1, "pool should actually run items concurrently");
});

test("forEachPooled hands each item to exactly one worker", async () => {
  const results: number[] = new Array(60);
  await forEachPooled(
    Array.from({ length: 60 }, (_, i) => i),
    4,
    undefined,
    "aborted",
    async (item, index) => {
      assert.equal(index, item);
      await tick();
      results[index] = item * 2;
    },
  );
  // Indexed placement keeps results in input order despite networked finish order.
  assert.deepEqual(
    results,
    Array.from({ length: 60 }, (_, i) => i * 2),
  );
});

test("first failure stops the queue and rejects with that error", async () => {
  const boom = new Error("boom");
  let started = 0;
  await assert.rejects(
    forEachPooled(
      Array.from({ length: 100 }, (_, i) => i),
      2,
      undefined,
      "aborted",
      async (item) => {
        started += 1;
        if (item === 1) throw boom;
        await tick();
      },
    ),
    (error: unknown) => error === boom,
  );
  // Workers stop pulling after the failure; at most the two that were
  // running plus their one overlap can have started.
  assert.ok(started <= 4, `${started} items started after failing fast`);
});

test("a pre-aborted signal rejects with 499 and runs nothing", async () => {
  const controller = new AbortController();
  controller.abort();
  let started = 0;
  await assert.rejects(
    forEachPooled(
      [1, 2, 3],
      2,
      controller.signal,
      "stream was aborted",
      async () => {
        started += 1;
      },
    ),
    (error: { statusCode?: number; statusMessage?: string }) => {
      return (
        error?.statusCode === 499 &&
        error?.statusMessage === "stream was aborted"
      );
    },
  );
  assert.equal(started, 0);
});

test("abort mid-run prevents untouched items from starting", async () => {
  const controller = new AbortController();
  let started = 0;
  await assert.rejects(
    forEachPooled(
      Array.from({ length: 50 }, (_, i) => i),
      1,
      controller.signal,
      "stream was aborted",
      async (item) => {
        started += 1;
        if (item === 2) controller.abort();
      },
    ),
    (error: { statusCode?: number }) => error?.statusCode === 499,
  );
  assert.equal(started, 3); // items 0..2; 3 was never pulled
});

test("empty work completes immediately", async () => {
  await forEachPooled([], 4, undefined, "aborted", async () => {
    throw new Error("unreachable");
  });
});
