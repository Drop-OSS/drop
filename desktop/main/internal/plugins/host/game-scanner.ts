import type { ScopedGameScanner } from "../types";
import { safeInvoke } from "../host";

export class TauriScopedGameScanner implements ScopedGameScanner {
  async scanExecutables(
    gameId: string,
  ): Promise<Array<{ relativePath: string; sha256: string; size: number }>> {
    return (
      (await safeInvoke<
        Array<{ relativePath: string; sha256: string; size: number }>
      >("plugin_game_scan_executables", { gameId }, [])) || []
    );
  }

  async findFiles(gameId: string, patterns: string[]): Promise<string[]> {
    return (
      (await safeInvoke<string[]>(
        "plugin_game_find_files",
        { gameId, patterns },
        [],
      )) || []
    );
  }
}
