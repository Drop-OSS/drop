import { afterAll, beforeAll } from "vitest";
import { setupAllMocks, teardownTestMocks } from "./mocks";

// Stub Nuxt globals that handlers may rely on.
// Real handler runs in Nuxt server context; tests don't have Nuxt loaded.
(globalThis as Record<string, unknown>).defineRouteMeta = () => {};
(globalThis as Record<string, unknown>).defineEventHandler = <T>(
  handler: T,
): T => handler;

// Request accessors
(globalThis as Record<string, unknown>).getHeader = () => undefined;
(globalThis as Record<string, unknown>).getQuery = () => ({});
(globalThis as Record<string, unknown>).getRouterParam = () => undefined;
(globalThis as Record<string, unknown>).readBody = async () => ({});
(globalThis as Record<string, unknown>).readFormDataBody = async () =>
  new FormData();
(globalThis as Record<string, unknown>).getCookie = () => undefined;
(globalThis as Record<string, unknown>).getRequestURL = () =>
  new URL("http://localhost");
(globalThis as Record<string, unknown>).getRequestIP = () =>
  ({ ip: "127.0.0.1", ipv6: undefined }) as {
    ip: string;
    ipv6: string | undefined;
  };

// Response mutators
(globalThis as Record<string, unknown>).setHeader = () => undefined;
(globalThis as Record<string, unknown>).setCookie = (
  _name: string,
  _value: string,
  _opts?: unknown,
) => undefined;
(globalThis as Record<string, unknown>).deleteCookie = () => undefined;
(globalThis as Record<string, unknown>).setResponseStatus = (
  _code: number,
  _msg?: string,
) => undefined;
(globalThis as Record<string, unknown>).setResponseHeaders = (
  _headers: Record<string, string>,
) => undefined;

// Response senders
(globalThis as Record<string, unknown>).sendRedirect = (
  _url: string,
  _code = 302,
) => undefined;
(globalThis as Record<string, unknown>).sendStream = () => undefined;
(globalThis as Record<string, unknown>).sendError = (
  _code: number,
  _msg?: string,
) => undefined;
(globalThis as Record<string, unknown>).sendNoContent = () => undefined;

// Error helpers
(globalThis as Record<string, unknown>).createError = (err: unknown) => err;
(globalThis as Record<string, unknown>).defineNitroPlugin = <T>(plugin: T): T =>
  plugin;
(globalThis as Record<string, unknown>).defineNitroErrorHandler = <T>(
  handler: T,
): T => handler;

beforeAll(() => {
  setupAllMocks();
});

afterAll(() => {
  teardownTestMocks();
});
