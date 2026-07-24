import { setupServer, type SetupServer } from "msw/node";
import type { HttpHandler } from "msw";
import { defaultOidcHandlers } from "./oidc";
import { allMetadataHandlers } from "./metadata";

// Re-export everything
export * from "./oidc";
export * from "./jwt";
export * from "./metadata";

// ---------------------------------------------------------------------------
// Lifecycle: setupTestMocks / teardownTestMocks
// ---------------------------------------------------------------------------

let server: SetupServer | null = null;

/**
 * Start MSW mock server with the given handlers.
 *
 * Call in `beforeAll()` (or `beforeEach()` for per-test isolation):
 * ```ts
 * import { setupTestMocks, teardownTestMocks, defaultOidcHandlers } from "./mocks";
 *
 * beforeAll(() => setupTestMocks(defaultOidcHandlers));
 * afterAll(() => teardownTestMocks());
 * ```
 */
export function setupTestMocks(...handlers: HttpHandler[][]): void {
  if (server) {
    throw new Error(
      "setupTestMocks was already called; call teardownTestMocks first.",
    );
  }

  const flatHandlers = handlers.flat();
  server = setupServer(...flatHandlers);
  server.listen({ onUnhandledRequest: "warn" });
}

/**
 * Stop the MSW mock server and clean up.
 *
 * Call in `afterAll()` (or `afterEach()`).
 */
export function teardownTestMocks(): void {
  if (server) {
    server.close();
    server = null;
  }
}

/**
 * Reset MSW handlers at runtime (e.g. in `afterEach()`).
 */
export function resetTestMocks(...handlers: HttpHandler[][]): void {
  if (!server) {
    throw new Error("setupTestMocks must be called before resetTestMocks.");
  }
  const flatHandlers = handlers.flat();
  server.resetHandlers(...flatHandlers);
}

/**
 * Convenience: setup all default mocks (OIDC + all metadata providers).
 *
 * ```ts
 * beforeAll(() => setupAllMocks());
 * afterAll(() => teardownTestMocks());
 * ```
 */
export function setupAllMocks(): void {
  setupTestMocks(defaultOidcHandlers, allMetadataHandlers());
}
