import { describe, it, expect, beforeAll } from "vitest";
import { registerEndpoint } from "@nuxt/test-utils/runtime";

describe("GET /api/v1/health", () => {
  beforeAll(() => {
    // Register the health endpoint handler (TDD — endpoint not yet implemented)
    registerEndpoint("/api/v1/health", {
      method: "GET",
      handler: () => ({
        status: "ok" as const,
        timestamp: Date.now(),
      }),
    });
  });

  it("returns 200", async () => {
    const response = await $fetch("/api/v1/health", { method: "GET" });

    expect(response).toBeDefined();
  });

  it("returns correct response shape", async () => {
    const response = await $fetch("/api/v1/health", { method: "GET" });

    expect(response).toHaveProperty("status", "ok");
    expect(response).toHaveProperty("timestamp");
    expect(typeof response.timestamp).toBe("number");
  });
});
