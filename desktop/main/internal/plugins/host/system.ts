import type { ClientPluginSystem, CommandResult } from "../types";
import { safeInvoke } from "../host";

/**
 * Build the `ctx.system` native-command surface for `pluginId`. The allowlist
 * is registered separately (`plugin_register_commands`); enforcement lives in
 * the Tauri command layer, not here, so a plugin cannot bypass it.
 */
export function createPluginSystem(pluginId: string): ClientPluginSystem {
  return {
    run: (
      bin: string,
      args?: string[],
      options?: { cwd?: string; timeoutMs?: number },
    ) =>
      safeInvoke<CommandResult>(
        "plugin_system_run",
        {
          pluginId,
          bin,
          args,
          cwd: options?.cwd,
          timeoutMs: options?.timeoutMs,
        },
        {
          code: 1,
          stdout: "",
          stderr: "Host native execution not available in browser mode",
        },
      ),
  };
}
