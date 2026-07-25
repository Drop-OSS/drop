// Mock H3 event factory for handler tests.
//
// Usage:
// ```ts
// import { createMockH3Event } from "~~/server/test/utils/h3";
//
// it("returns 200 with body", async () => {
//   const event = createMockH3Event({ method: "POST", body: { id: 1 } });
//   const result = await myHandler(event);
//   expect(result).toEqual({ ok: true });
// });
// ```
//
// The returned object is a partial H3Event. Override individual fields per
// test rather than building a full event from scratch. Methods like
// `node.res.end` are spied on (vi.fn) so handlers that write headers or
// stream can be asserted against.

import { vi } from "vitest";

export interface MockH3Options {
  method?: string;
  url?: string;
  body?: unknown;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  routerParams?: Record<string, string>;
  statusCode?: number;
}

export function createMockH3Event(opts: MockH3Options = {}): unknown {
  const status = { value: opts.statusCode ?? 200 };
  const setHeader = vi.fn();
  const getHeader = (name: string) => opts.headers?.[name.toLowerCase()];
  const getCookie = (name: string) => opts.cookies?.[name];
  const getQuery = () => opts.query ?? {};
  const getRouterParam = (name: string) => opts.routerParams?.[name];
  const readBody = async () => opts.body;
  const getRequestURL = () => new URL(opts.url ?? "http://localhost");
  const sendError = vi.fn();
  const setResponseStatus = (code: number) => {
    status.value = code;
  };
  const setCookie = vi.fn();
  const deleteCookie = vi.fn();
  const sendRedirect = vi.fn();

  return {
    method: opts.method ?? "GET",
    node: {
      req: { headers: opts.headers ?? {} },
      res: {
        setHeader,
        end: vi.fn(),
        statusCode: status.value,
      },
    },
    context: {},
    headers: opts.headers ?? {},
    response: { status },
    _status: status,
    setHeader,
    getHeader,
    getCookie,
    setCookie,
    deleteCookie,
    getQuery,
    getRouterParam,
    readBody,
    getRequestURL,
    getRequestIP: () => "127.0.0.1",
    setResponseStatus,
    sendError,
    sendRedirect,
    sendNoContent: vi.fn(),
  };
}
