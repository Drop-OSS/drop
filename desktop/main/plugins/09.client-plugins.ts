import * as Vue from "vue";
import { invoke } from "@tauri-apps/api/core";
import { clientPluginManager } from "~/internal/plugins/ClientPluginManager";

declare global {
  interface Window {
    Vue?: unknown;
  }
}

if (typeof window !== "undefined") {
  window.Vue = Vue;
}

interface RemotePluginInfo {
  id: string;
  name: string;
  version: string;
  status: "active" | "disabled" | "error";
  targets?: string[];
  client?: {
    entry?: string;
    css?: string;
    commands?: string[];
    sidecars?: Array<{
      name: string;
      targets: Array<{
        os: "linux" | "macos" | "windows";
        arch: "x64" | "arm64";
        path: string;
        sha256: string;
      }>;
    }>;
  };
}

async function loadRemotePlugin(plugin: RemotePluginInfo): Promise<void> {
  if (plugin.status !== "active") return;
  const targets = plugin.targets;
  if (targets && !targets.includes("client")) return;

  const entry = plugin.client?.entry || "bundle.js";
  const clientJsUrl = `/api/v1/plugins/${plugin.id}/client/${entry}`;
  const clientCssUrl = plugin.client?.css
    ? `/api/v1/plugins/${plugin.id}/client/${plugin.client.css}`
    : undefined;
  const commands = Array.isArray(plugin.client?.commands)
    ? plugin.client.commands
    : [];
  const sidecars = Array.isArray(plugin.client?.sidecars)
    ? plugin.client.sidecars
    : [];

  try {
    await clientPluginManager.loadFromUrl(
      plugin.id,
      clientJsUrl,
      clientCssUrl,
      commands,
      [],
      sidecars,
    );
  } catch (loadErr) {
    console.debug(
      `Plugin ${plugin.id} has no client bundle or failed to load:`,
      loadErr,
    );
  }
}

async function fetchRemotePlugins(): Promise<RemotePluginInfo[]> {
  const res = await invoke<{ plugins: RemotePluginInfo[] }>("plugin_request", {
    pluginId: "",
    method: "GET",
    path: "",
  }).catch(() => null);

  return res && Array.isArray(res.plugins) ? res.plugins : [];
}

export default defineNuxtPlugin(async () => {
  if (clientPluginManager.isInitialized.value) return;

  try {
    const plugins = await fetchRemotePlugins();
    for (const plugin of plugins) {
      await loadRemotePlugin(plugin);
    }
  } catch (err) {
    console.debug(
      "Could not reach Drop server for client plugin discovery:",
      err,
    );
  } finally {
    clientPluginManager.isInitialized.value = true;
  }
});
