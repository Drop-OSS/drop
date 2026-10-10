import { invoke } from "@tauri-apps/api/core";

/**
 * Whether the client is running inside a Tauri webview. Browser/dev builds
 * fall back to in-memory implementations so the UI can still boot.
 */
export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

/**
 * Invoke a Tauri command, returning `fallback` (or `null`) in browser mode
 * instead of throwing so plugin code degrades gracefully outside the desktop.
 */
export async function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
  fallback?: T,
): Promise<T> {
  if (!isTauri()) {
    console.debug(
      `[ClientPluginManager] Browser mode: invoke('${cmd}') bypassed`,
    );
    return fallback !== undefined ? fallback : (null as unknown as T);
  }
  return await invoke<T>(cmd, args);
}
