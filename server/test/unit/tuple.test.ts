import { describe, expect, it } from "vitest";
import Tuple from "../../../server/utils/tuple";

describe("Tuple", () => {
  it("stores x and y", () => {
    const t = new Tuple(3, 4);
    expect(t.x).toBe(3);
    expect(t.y).toBe(4);
  });

  it("serializes as x,y", () => {
    expect(new Tuple(1, 2).toString()).toBe("1,2");
    expect(new Tuple(-1, 0.5).toString()).toBe("-1,0.5");
  });
});
