/**
 * E2E smoke test: verifies the dev server boots and the health endpoint
 * responds. Health is a pure handler (no DB, no auth) so it works in
 * bare CI without service dependencies.
 *
 * Catches:
 * - Port mismatch between Playwright config and nuxt.config.ts
 * - Dev server crash on boot (e.g. tailwindcss plugin recursion)
 * - Routing/middleware misconfiguration that breaks API routes
 */
import { test, expect } from "@playwright/test";

test.describe("E2E smoke", () => {
  test("health endpoint responds", async ({ request }) => {
    const response = await request.get("/api/v1/health");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      status: string;
      timestamp: number;
    };
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("number");
  });
});
