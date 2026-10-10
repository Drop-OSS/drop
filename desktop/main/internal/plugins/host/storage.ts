import type { ClientPluginStorage } from "../types";
import { isTauri, safeInvoke } from "../host";

export class TauriPluginStorage implements ClientPluginStorage {
  // Browser/dev fallback. Plugin state lives in the Rust-side database when
  // Tauri is available so frontend and backend never split their state.
  private readonly memory = new Map<string, unknown>();

  constructor(private readonly pluginId: string) {}

  async get<T>(key: string): Promise<T | null> {
    if (!isTauri()) {
      return this.memory.has(key) ? (this.memory.get(key) as T) : null;
    }
    return (
      (await safeInvoke<T | null>(
        "plugin_storage_get",
        { pluginId: this.pluginId, key },
        null,
      )) ?? null
    );
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!isTauri()) {
      this.memory.set(key, value);
      return;
    }
    await safeInvoke("plugin_storage_set", {
      pluginId: this.pluginId,
      key,
      value,
    });
  }

  async delete(key: string): Promise<void> {
    if (!isTauri()) {
      this.memory.delete(key);
      return;
    }
    await safeInvoke("plugin_storage_delete", {
      pluginId: this.pluginId,
      key,
    });
  }

  async listKeys(): Promise<string[]> {
    if (!isTauri()) {
      return Array.from(this.memory.keys());
    }
    return (
      (await safeInvoke<string[]>(
        "plugin_storage_list_keys",
        { pluginId: this.pluginId },
        [],
      )) || []
    );
  }
}
