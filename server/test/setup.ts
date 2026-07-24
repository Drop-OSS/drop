import { afterAll, beforeAll } from "vitest";
import { setupAllMocks, teardownTestMocks } from "./mocks";

// Stub Nuxt globals that handlers may rely on.
// Real handler runs in Nuxt server context; tests don't have Nuxt loaded.
(globalThis as Record<string, unknown>).defineRouteMeta = () => {};
(globalThis as Record<string, unknown>).defineEventHandler = <T>(
  handler: T,
): T => handler;
(globalThis as Record<string, unknown>).getHeader = () => undefined;
(globalThis as Record<string, unknown>).getQuery = () => ({});
(globalThis as Record<string, unknown>).getRouterParam = () => undefined;
(globalThis as Record<string, unknown>).readBody = async () => ({});
(globalThis as Record<string, unknown>).createError = (err: unknown) => err;

beforeAll(() => {
  setupAllMocks();
});

afterAll(() => {
  teardownTestMocks();
});
