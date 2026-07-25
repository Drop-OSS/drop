import { describe, expect, it } from "vitest";
import { lastItem, sum } from "../../../server/utils/array";

describe("sum", () => {
  it("returns 0 for an empty array", () => {
    expect(sum([])).toBe(0);
  });

  it("sums positive numbers", () => {
    expect(sum([1, 2, 3, 4])).toBe(10);
  });

  it("sums negative and positive mixed", () => {
    expect(sum([10, -5, 3])).toBe(8);
  });

  it("returns the single value for a one-element array", () => {
    expect(sum([42])).toBe(42);
  });

  it("does not mutate the input array", () => {
    const arr = [1, 2, 3];
    const snapshot = [...arr];
    sum(arr);
    expect(arr).toEqual(snapshot);
  });
});

describe("lastItem", () => {
  it("returns undefined for an empty array", () => {
    expect(lastItem([])).toBeUndefined();
  });

  it("returns the only element for a one-element array", () => {
    expect(lastItem(["only"])).toBe("only");
  });

  it("returns the last element of a multi-element array", () => {
    expect(lastItem([1, 2, 3])).toBe(3);
  });

  it("preserves object references", () => {
    const obj = { id: 7 };
    expect(lastItem([{ id: 1 }, obj])).toBe(obj);
  });
});
