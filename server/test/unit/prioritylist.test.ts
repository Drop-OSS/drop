import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  PriorityList,
  PriorityListIndexed,
} from "../../server/internal/utils/prioritylist";

interface Tagged {
  id: string;
}

describe("PriorityList", () => {
  it("returns an empty array when no items pushed", () => {
    const list = new PriorityList<Tagged>();
    expect(list.values()).toEqual([]);
  });

  it("returns pushed items in insertion order when all priorities equal", () => {
    const list = new PriorityList<Tagged>();
    list.push({ id: "a" });
    list.push({ id: "b" });
    list.push({ id: "c" });
    expect(list.values()).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  it("sorts by priority (higher first), then by insertion order", () => {
    const list = new PriorityList<Tagged>();
    list.push({ id: "a" }, 0);
    list.push({ id: "b" }, 10);
    list.push({ id: "c" }, 10);
    list.push({ id: "d" }, 5);
    expect(list.values()).toEqual([
      { id: "b" },
      { id: "c" },
      { id: "d" },
      { id: "a" },
    ]);
  });

  it("removes an item via pop()", () => {
    const list = new PriorityList<Tagged>();
    list.push({ id: "a" });
    list.push({ id: "b" });
    const popped = list.pop();
    expect(popped?.object).toEqual({ id: "a" });
    expect(list.values()).toEqual([{ id: "b" }]);
  });

  it("caches the sorted result between calls (mutation invalidates cache)", () => {
    const list = new PriorityList<Tagged>();
    list.push({ id: "a" }, 0);
    list.push({ id: "b" }, 5);
    const first = list.values();
    list.push({ id: "c" }, 10);
    const second = list.values();
    expect(first).not.toBe(second);
    expect(second).toEqual([{ id: "c" }, { id: "b" }, { id: "a" }]);
  });

  it("finds an item by predicate", () => {
    const list = new PriorityList<Tagged>();
    list.push({ id: "a" });
    list.push({ id: "b" });
    expect(list.find((v) => v.id === "b")).toEqual({ id: "b" });
    expect(list.find((v) => v.id === "missing")).toBeUndefined();
  });
});

describe("PriorityListIndexed", () => {
  it("indexes items by the named property", () => {
    const list = new PriorityListIndexed<Tagged>("id");
    list.push({ id: "a" });
    list.push({ id: "b" });
    expect(list.get("a")).toEqual({ id: "a" });
    expect(list.get("b")).toEqual({ id: "b" });
    expect(list.get("c")).toBeUndefined();
  });

  it("removes from the index on pop()", () => {
    const list = new PriorityListIndexed<Tagged>("id");
    list.push({ id: "a" });
    list.push({ id: "b" });
    list.pop();
    expect(list.get("a")).toBeUndefined();
    expect(list.get("b")).toEqual({ id: "b" });
  });

  it("throws when popping an empty list", () => {
    // PR #29 added an explicit throw guard in prioritylist.ts:pop().
    // super.pop() returns undefined; the new code throws with a clear
    // message instead of letting getIndex(value.object) crash.
    const list = new PriorityListIndexed<Tagged>("id");
    expect(() => list.pop()).toThrow(/empty/);
  });
});

interface TaggedWithPriority {
  id: string;
}

describe("PriorityList (property-based)", () => {
  const itemArb = fc.record({
    id: fc.string(),
    priority: fc.integer({ min: -100, max: 100 }),
  });

  it("values() returns items sorted by priority descending, then by insertion order", () => {
    fc.assert(
      fc.property(
        fc.array(itemArb, { minLength: 0, maxLength: 30 }),
        (items: Array<{ id: string; priority: number }>) => {
          const list = new PriorityList<TaggedWithPriority>();
          const priorities = new Map<string, number>();
          const addedOrder = new Map<string, number>();

          for (let i = 0; i < items.length; i++) {
            const key = `${items[i].id}\x00${i}`;
            list.push({ id: key }, items[i].priority);
            priorities.set(key, items[i].priority);
            addedOrder.set(key, i);
          }

          const result = list.values();
          for (let i = 1; i < result.length; i++) {
            const a = result[i - 1];
            const b = result[i];
            const pa = priorities.get(a.id)!;
            const pb = priorities.get(b.id)!;
            if (pa === pb) {
              expect(addedOrder.get(a.id)).toBeLessThan(addedOrder.get(b.id)!);
            } else {
              expect(pa).toBeGreaterThan(pb);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("consecutive values() calls return the same result (no mutation between calls)", () => {
    fc.assert(
      fc.property(
        fc.array(itemArb, { minLength: 1, maxLength: 30 }),
        (items: Array<{ id: string; priority: number }>) => {
          const list = new PriorityList<TaggedWithPriority>();
          for (const item of items) {
            list.push({ id: item.id }, item.priority);
          }
          const first = list.values();
          const second = list.values();
          expect(first).toEqual(second);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("PriorityListIndexed (property-based)", () => {
  const itemArb = fc.record({
    id: fc.string({ minLength: 1 }),
    priority: fc.integer({ min: -100, max: 100 }),
  });

  it("get() returns the same item at the same key as long as it hasn't been popped", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(itemArb, {
          selector: (item) => item.id,
          minLength: 1,
          maxLength: 30,
        }),
        (items: Array<{ id: string; priority: number }>) => {
          const list = new PriorityListIndexed<TaggedWithPriority>("id");
          for (const item of items) {
            list.push({ id: item.id }, item.priority);
          }

          for (const item of items) {
            expect(list.get(item.id)).toEqual({ id: item.id });
          }

          const popped = list.pop();
          expect(list.get(popped.object.id)).toBeUndefined();
          for (let i = 1; i < items.length; i++) {
            expect(list.get(items[i].id)).toEqual({ id: items[i].id });
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
