import { PLUGIN_API_VERSION, SUPPORTED_API_VERSIONS } from "./types";
import { PluginApiVersionError, PluginTrustError } from "./errors";
import type { PluginManifest, ServerPlugin } from "./types";

const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

export function isValidPluginId(id: string): boolean {
  return id.length > 0 && id.length <= 64 && PLUGIN_ID_PATTERN.test(id);
}

/**
 * Validate a manifest's declared contract before importing its module.
 * Compatibility must be checked on the manifest, not after the module has
 * already executed.
 */
export function assertManifestCompatible(manifest: PluginManifest): void {
  const version = manifest.apiVersion ?? 0;
  if (!(SUPPORTED_API_VERSIONS as readonly number[]).includes(version)) {
    throw new PluginApiVersionError(manifest.id, PLUGIN_API_VERSION, version);
  }
  if (manifest.trust !== undefined && manifest.trust !== "trusted") {
    throw new PluginTrustError(manifest.id, manifest.trust);
  }
  assertClientCommands(manifest);
}

/**
 * Fail closed on the native-command capability: a plugin that declares
 * `system:command` must ship a non-empty, bare-name `client.commands`
 * allowlist. The desktop host enforces the same allowlist at run time; this
 * rejects a malformed manifest before its module is imported.
 */
function assertClientCommands(manifest: PluginManifest): void {
  const capabilities = manifest.client?.capabilities ?? [];
  if (!capabilities.includes("system:command")) return;
  const commands = manifest.client?.commands;
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new Error(
      `plugin '${manifest.id}' declares 'system:command' but has no client.commands allowlist`,
    );
  }
  for (const command of commands) {
    if (typeof command !== "string" || command.trim().length === 0) {
      throw new Error(
        `plugin '${manifest.id}' has an invalid client.commands entry`,
      );
    }
    if (command.includes("/") || command.includes("\\")) {
      throw new Error(
        `plugin '${manifest.id}' client.commands must be bare executable names`,
      );
    }
  }
}

/** Validate an in-process plugin's declared contract before registration. */
export function assertPluginCompatible(plugin: ServerPlugin): void {
  const { id, apiVersion, trust } = plugin.metadata;
  const version = apiVersion ?? 0;
  // Every plugin must declare the contract version it was built against;
  // omitting it previously bypassed the compatibility gate entirely.
  if (!(SUPPORTED_API_VERSIONS as readonly number[]).includes(version)) {
    throw new PluginApiVersionError(id, PLUGIN_API_VERSION, version);
  }
  if (trust !== undefined && trust !== "trusted") {
    throw new PluginTrustError(id, trust);
  }
}
