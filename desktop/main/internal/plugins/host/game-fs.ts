import type { ScopedGameFs } from "../types";
import { safeInvoke } from "../host";

export class TauriScopedGameFs implements ScopedGameFs {
  async readFile(gameId: string, relativePath: string): Promise<Uint8Array> {
    const res = await safeInvoke<number[]>(
      "plugin_game_fs_read",
      { gameId, relativePath },
      [],
    );
    return new Uint8Array(res);
  }

  async writeFile(
    gameId: string,
    relativePath: string,
    data: Uint8Array | string,
  ): Promise<void> {
    const bytes =
      typeof data === "string"
        ? Array.from(new TextEncoder().encode(data))
        : Array.from(data);
    await safeInvoke("plugin_game_fs_write", {
      gameId,
      relativePath,
      data: bytes,
    });
  }

  async backupFile(gameId: string, relativePath: string): Promise<string> {
    return (
      (await safeInvoke<string>("plugin_game_fs_backup", {
        gameId,
        relativePath,
      })) || ""
    );
  }

  async restoreFile(gameId: string, relativePath: string): Promise<void> {
    await safeInvoke("plugin_game_fs_restore", {
      gameId,
      relativePath,
    });
  }

  async fileExists(gameId: string, relativePath: string): Promise<boolean> {
    return (
      (await safeInvoke<boolean>(
        "plugin_game_fs_exists",
        { gameId, relativePath },
        false,
      )) ?? false
    );
  }

  async deleteFile(gameId: string, relativePath: string): Promise<void> {
    await safeInvoke("plugin_game_fs_delete", {
      gameId,
      relativePath,
    });
  }
}
