import { describe, expect, it } from "vitest";
import { getBarColor } from "../../../server/utils/colors";

describe("getBarColor", () => {
  it("returns blue for 0", () => {
    expect(getBarColor(0)).toBe("blue");
  });

  it("returns blue for 70 (boundary)", () => {
    expect(getBarColor(70)).toBe("blue");
  });

  it("returns orange for 71", () => {
    expect(getBarColor(71)).toBe("orange");
  });

  it("returns orange for 90 (boundary)", () => {
    expect(getBarColor(90)).toBe("orange");
  });

  it("returns red for 91", () => {
    expect(getBarColor(91)).toBe("red");
  });

  it("returns red for 100", () => {
    expect(getBarColor(100)).toBe("red");
  });
});
