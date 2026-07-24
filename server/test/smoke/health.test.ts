import { describe, it, expect } from "vitest";
import handler from "../../server/api/v1/health.get";

/**
 * H3Event mock for handler invocation.
 * The handler signature is (event: H3Event) => response.
 * The health endpoint doesn't read any event properties, so we pass `{} as any`.
 */
type H3Event = Parameters<typeof handler>[0];

const mockEvent = {} as H3Event;

describe("GET /api/v1/health handler", () => {
  it("returns status ok", () => {
    const response = handler(mockEvent);
    expect(response).toHaveProperty("status", "ok");
  });

  it("returns timestamp as number close to now", () => {
    const before = Date.now();
    const response = handler(mockEvent) as {
      status: string;
      timestamp: number;
    };
    const after = Date.now();
    expect(typeof response.timestamp).toBe("number");
    expect(response.timestamp).toBeGreaterThanOrEqual(before);
    expect(response.timestamp).toBeLessThanOrEqual(after);
  });

  it("returns only status and timestamp keys (no leakage)", () => {
    const response = handler(mockEvent) as Record<string, unknown>;
    expect(Object.keys(response).sort()).toEqual(["status", "timestamp"]);
  });

  it("returns monotonic timestamps across rapid calls", () => {
    const first = (handler(mockEvent) as { timestamp: number }).timestamp;
    const second = (handler(mockEvent) as { timestamp: number }).timestamp;
    expect(second).toBeGreaterThanOrEqual(first);
  });
});
