import type { ScannedGame, StoreScanner } from "./types";

export interface StoreImportResult {
  games: ScannedGame[];
  failures: Array<{ store: string; error: string }>;
}

/**
 * Runs every plugin-registered `StoreScanner` SPI and aggregates the results.
 * A scanner that throws is recorded as a failure and does not abort the scan,
 * so one broken store integration cannot block a library import.
 */
export async function collectStoreGames(
  scanners: StoreScanner[],
): Promise<StoreImportResult> {
  const games: ScannedGame[] = [];
  const failures: Array<{ store: string; error: string }> = [];

  for (const scanner of scanners) {
    try {
      const discovered = await scanner.scan();
      games.push(...discovered);
    } catch (error) {
      failures.push({
        store: scanner.store,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { games, failures };
}
