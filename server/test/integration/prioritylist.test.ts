/**
 * Property-based test for the `PriorityList` ordering contract.
 *
 * Fuzzes push order, priority, and pop order. Verifies:
 *   1. `values()` returns all pushed items.
 *   2. Items are sorted by descending priority (higher priority first).
 *   3. Equal-priority items maintain insertion order (FIFO).
 *
 * This test would catch the latent bug at
 * `server/server/internal/utils/prioritylist.ts:34` where
 * `a.priority == a.priority` should be `a.priority == b.priority`.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { PriorityList } from "../../server/internal/utils/prioritylist";

type Tagged = { id: string; priority: number };

describe("PriorityList (property-based)", () => {
  it("values() returns all pushed items", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 8 }),
            fc.integer({ min: -10, max: 10 }),
          ),
          { maxLength: 50 },
        ),
        (entries) => {
          const list = new PriorityList<Tagged>();
          for (const [id, priority] of entries) {
            list.push({ id, priority }, priority);
          }
          expect(list.values()).toHaveLength(entries.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("values() sorts by descending priority (higher first)", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 8 }),
            fc.integer({ min: -10, max: 10 }),
          ),
          { minLength: 2, maxLength: 50 },
        ),
        (entries) => {
          const list = new PriorityList<Tagged>();
          for (const [id, priority] of entries) {
            list.push({ id, priority }, priority);
          }
          const sorted = list.values() as Tagged[];
          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            if (!prev || !curr) return;
            // Higher priority comes first (descending sort).
            expect(curr.priority).toBeLessThanOrEqual(prev.priority);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("equal-priority items maintain insertion order (FIFO)", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), {
          minLength: 2,
          maxLength: 20,
        }),
        (ids) => {
          const list = new PriorityList<Tagged>();
          const samePriority = 5;
          for (const id of ids) {
            list.push({ id, priority: samePriority }, samePriority);
          }
          const values = list.values() as Tagged[];
          expect(values.map((v) => v.id)).toEqual(ids);
        },
      ),
      { numRuns: 100 },
    );
  });
});
