import { describe, it, expect } from "vitest";
import handler from "../../server/api/v1/health.get";

describe("GET /api/v1/health handler", () => {
  it("returns status ok", () => {
    const response = handler();
    expect(response).toHaveProperty("status", "ok");
  });

  it("returns timestamp as number close to now", () => {
    const before = Date.now();
    const response = handler() as { status: string; timestamp: number };
    const after = Date.now();
    expect(typeof response.timestamp).toBe("number");
    expect(response.timestamp).toBeGreaterThanOrEqual(before);
    expect(response.timestamp).toBeLessThanOrEqual(after);
  });
});
