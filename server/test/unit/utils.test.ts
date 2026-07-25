import { describe, expect, it } from "vitest";
import { getPercentage } from "../../../server/utils/utils";

describe("getPercentage", () => {
  it("computes value/total as a percent", () => {
    expect(getPercentage(50, 100)).toBe(50);
  });

  it("handles 0/total = 0", () => {
    expect(getPercentage(0, 100)).toBe(0);
  });

  it("handles value > total (over 100%)", () => {
    expect(getPercentage(150, 100)).toBe(150);
  });

  it("returns Infinity when total is 0 (current behavior — does not handle div-by-zero)", () => {
    // Current code: 5*100/0 = Infinity. Number.isNaN(Infinity) is false,
    // so the NaN-guard doesn't fire. The function returns Infinity, not 0.
    // Documenting current behavior; a div-by-zero guard is a future fix.
    expect(getPercentage(5, 0)).toBe(Infinity);
  });

  it("handles fractional values", () => {
    expect(getPercentage(1, 3)).toBeCloseTo(33.333, 2);
  });
});
