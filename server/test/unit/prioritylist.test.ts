import { describe, expect, it } from "vitest";
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
