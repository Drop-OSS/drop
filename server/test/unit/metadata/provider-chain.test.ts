/**
 * F2: Metadata Provider Chain Fallthrough
 *
 * Tests MetadataHandler.search() which:
 * - Runs ALL providers in PARALLEL via Promise.allSettled (not sequential)
 * - Each provider has a per-provider timeout via setTimeout
 * - Failed/timeout providers are filtered out
 * - Results from all successful providers are merged and sorted by fuzzy score desc
 * - Providers implement MetadataProvider abstract class
 *
 * Key behaviors verified:
 * 1. Failures don't block other providers' results
 * 2. All providers fail → empty array (not crash)
 * 3. Timeout excludes slow providers
 * 4. Multi-provider results sorted correctly by fuzzy match
 * 5. Empty results from providers don't add noise
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  MetadataHandler,
  MetadataProvider,
} from "../../../server/internal/metadata/index";
import { MetadataSource } from "~/prisma/client/enums";
import type { GameMetadataSearchResult } from "../../../server/internal/metadata/types";

// ---------------------------------------------------------------------------
// Module mocks - hoisted by vitest before all imports
// ---------------------------------------------------------------------------

// Mock systemConfig so its singleton doesn't call useRuntimeConfig() at import
vi.mock("../../../server/internal/config/sys-conf", () => ({
  systemConfig: {
    getMetadataTimeout: () => 100,
    getDropVersion: () => "test",
  },
}));

// Mock database to prevent Prisma client init from connecting to a real DB
vi.mock("../../../server/internal/db/database", () => ({
  default: {},
}));

// Mock objects module to prevent useStorage() call during module load
// (ObjectTransactionalHandler imports objects/index.ts which triggers FsHashStore → useStorage)
vi.mock("../../../server/internal/objects", () => ({
  default: {},
}));

// Mock tasks module to prevent acls→session→cacheHandler→useStorage chain
vi.mock("../../../server/internal/tasks", () => ({
  default: { create: vi.fn() },
  wrapTaskContext: vi.fn(),
}));

// Mock library module to prevent gamesize→manifest→cacheHandler→useStorage chain
vi.mock("../../../server/internal/library", () => ({
  createGameImportTaskId: vi.fn().mockReturnValue("test-task-id"),
}));

// Mock fast-fuzzy so fuzzy scores are deterministic for sorting tests
vi.mock("fast-fuzzy", () => ({
  fuzzy: vi.fn((_query: string, name: string) => {
    const scores: Record<string, number> = {
      "Exact Match": 1,
      "Close Match": 0.85,
      "Mediocre Match": 0.5,
      "Distant Match": 0.2,
    };
    return scores[name] ?? 0.3;
  }),
}));

// ---------------------------------------------------------------------------
// Mock Provider Classes
// ---------------------------------------------------------------------------

class FailingProvider extends MetadataProvider {
  name(): string {
    return "FailingProvider";
  }
  source(): MetadataSource {
    return MetadataSource.IGDB;
  }
  async search(): Promise<GameMetadataSearchResult[]> {
    throw new Error("Provider simulated failure");
  }
  async fetchGame(): Promise<never> {
    throw new Error("not used in search test");
  }
  async fetchCompany(): Promise<undefined> {
    return undefined;
  }
}

class MockSuccessProvider extends MetadataProvider {
  readonly name: () => string;
  readonly source: () => MetadataSource;
  readonly results: GameMetadataSearchResult[];

  constructor(
    label: string,
    src: MetadataSource,
    results: GameMetadataSearchResult[],
  ) {
    super();
    // Use arrow properties so `this` is captured from constructor scope,
    // working around PriorityListIndexed.getIndex calling index() without binding
    this.name = () => label;
    this.source = () => src;
    this.results = results;
  }

  async search(): Promise<GameMetadataSearchResult[]> {
    return this.results;
  }
  async fetchGame(): Promise<never> {
    throw new Error("not used in search test");
  }
  async fetchCompany(): Promise<undefined> {
    return undefined;
  }
}

class TimeoutProvider extends MetadataProvider {
  name(): string {
    return "TimeoutProvider";
  }
  source(): MetadataSource {
    return MetadataSource.GiantBomb;
  }
  async search(): Promise<GameMetadataSearchResult[]> {
    // Delay longer than the 100ms mock timeout
    await new Promise((r) => setTimeout(r, 500));
    return [
      {
        id: "slow",
        name: "Slow Result",
        icon: "",
        description: "",
        year: 2024,
      },
    ];
  }
  async fetchGame(): Promise<never> {
    throw new Error("not used in search test");
  }
  async fetchCompany(): Promise<undefined> {
    return undefined;
  }
}

class EmptyProvider extends MetadataProvider {
  name(): string {
    return "EmptyProvider";
  }
  source(): MetadataSource {
    return MetadataSource.Manual;
  }
  async search(): Promise<GameMetadataSearchResult[]> {
    return [];
  }
  async fetchGame(): Promise<never> {
    throw new Error("not used in search test");
  }
  async fetchCompany(): Promise<undefined> {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MetadataHandler provider chain (search)", () => {
  let handler: MetadataHandler;

  beforeEach(() => {
    handler = new MetadataHandler();
  });

  // -----------------------------------------------------------------------
  // F2.1: Provider failure + success mix
  // -----------------------------------------------------------------------
  it("returns merged results from all successful providers when some fail", async () => {
    handler.addProvider(new FailingProvider(), 10);
    handler.addProvider(
      new MockSuccessProvider("ProvB", MetadataSource.Steam, [
        {
          id: "b1",
          name: "Close Match",
          icon: "",
          description: "",
          year: 2024,
        },
        {
          id: "b2",
          name: "Exact Match",
          icon: "",
          description: "",
          year: 2023,
        },
      ]),
      5,
    );
    handler.addProvider(
      new MockSuccessProvider("ProvC", MetadataSource.GiantBomb, [
        {
          id: "c1",
          name: "Mediocre Match",
          icon: "",
          description: "",
          year: 2022,
        },
      ]),
      0,
    );

    const results = await handler.search("test");

    // All 3 results from the 2 successful providers should be present
    expect(results).toHaveLength(3);
    const ids = results.map((r) => r.id);
    expect(ids).toContain("b1");
    expect(ids).toContain("b2");
    expect(ids).toContain("c1");
    // Each result should have source metadata attached
    expect(results.every((r) => "sourceId" in r && "sourceName" in r)).toBe(
      true,
    );
  });

  // -----------------------------------------------------------------------
  // F2.2: All providers fail → empty result
  // -----------------------------------------------------------------------
  it("returns empty array when all providers fail (no crash)", async () => {
    handler.addProvider(new FailingProvider(), 10);
    handler.addProvider(new FailingProvider(), 5);

    const results = await handler.search("test query");

    expect(results).toEqual([]);
  });

  it("returns empty array when all providers return empty results", async () => {
    handler.addProvider(new EmptyProvider(), 10);
    handler.addProvider(new EmptyProvider(), 5);

    const results = await handler.search("anything");

    expect(results).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // F2.3: Provider timeout interleaving
  // -----------------------------------------------------------------------
  it("excludes timed-out providers but keeps fast providers' results", async () => {
    handler.addProvider(
      new MockSuccessProvider("FastA", MetadataSource.Steam, [
        {
          id: "fast1",
          name: "Fast Result",
          icon: "",
          description: "",
          year: 2024,
        },
      ]),
      10,
    );
    handler.addProvider(new TimeoutProvider(), 5);
    handler.addProvider(
      new MockSuccessProvider("FastB", MetadataSource.IGDB, [
        {
          id: "fast2",
          name: "Quick Result",
          icon: "",
          description: "",
          year: 2025,
        },
      ]),
      0,
    );

    const results = await handler.search("test");

    // Only the 2 fast providers' results, not the timed-out one
    expect(results).toHaveLength(2);
    const ids = results.map((r) => r.id);
    expect(ids).toContain("fast1");
    expect(ids).toContain("fast2");
    expect(ids).not.toContain("slow");
  });

  // -----------------------------------------------------------------------
  // F2.4: Fuzzy sort correctness across multi-provider results
  // -----------------------------------------------------------------------
  it("sorts merged results by fuzzy match score in descending order", async () => {
    handler.addProvider(
      new MockSuccessProvider("ProvA", MetadataSource.Steam, [
        {
          id: "distant",
          name: "Distant Match",
          icon: "",
          description: "",
          year: 2020,
        },
      ]),
      5,
    );
    handler.addProvider(
      new MockSuccessProvider("ProvB", MetadataSource.IGDB, [
        {
          id: "exact",
          name: "Exact Match",
          icon: "",
          description: "",
          year: 2024,
        },
        {
          id: "mediocre",
          name: "Mediocre Match",
          icon: "",
          description: "",
          year: 2022,
        },
      ]),
      10,
    );

    const results = await handler.search("query");

    // Sorted by fuzzy score descending: Exact (1) > Mediocre (0.5) > Distant (0.2)
    expect(results.map((r) => r.id)).toEqual(["exact", "mediocre", "distant"]);
    // Verify scores are monotonically non-increasing
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].fuzzy).toBeGreaterThanOrEqual(results[i].fuzzy);
    }
  });
});
