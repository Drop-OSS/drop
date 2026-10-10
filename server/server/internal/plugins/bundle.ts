import * as fs from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { Logger } from "pino";
import { assertManifestCompatible, isValidPluginId } from "./compat";
import type { PluginRegistry } from "./registry";
import { isInsideDirectory, verifyEntryChecksum } from "./verification";
import type {
  PluginManifest,
  PluginMetadata,
  PluginStatus,
  ServerPlugin,
} from "./types";

/** Structured view of a dynamically imported plugin bundle module. */
export interface PluginModule {
  default?: unknown;
  plugin?: unknown;
}

export interface PluginUpdateInfo {
  id: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  downloadUrl?: string;
}

/** Manager surface the bundle loader depends on. */
export interface PluginBundleHost {
  log: Logger;
  getPluginsDirectory(): Promise<string>;
  getRegistry(): Promise<PluginRegistry>;
  registerPlugin(plugin: ServerPlugin): Promise<void>;
  unregisterPlugin(id: string): Promise<void>;
  getPlugin(id: string): ServerPlugin | undefined;
  listPlugins(): Array<
    PluginMetadata & { status: PluginStatus; error?: string }
  >;
}

/** Resolves a dynamically imported bundle's default or named plugin export. */
export function resolvePluginExport(mod: PluginModule): ServerPlugin | null {
  const defaultExport = mod.default as Partial<ServerPlugin> | undefined;
  if (defaultExport && typeof defaultExport.init === "function") {
    return defaultExport as ServerPlugin;
  }
  const namedExport = mod.plugin as Partial<ServerPlugin> | undefined;
  if (namedExport && typeof namedExport.init === "function") {
    return namedExport as ServerPlugin;
  }
  if (typeof mod.default === "function") {
    return new (mod.default as new () => ServerPlugin)();
  }
  return null;
}

/** Verify, import and register a bundle directory. */
async function loadExternalPluginFromDir(
  host: PluginBundleHost,
  pluginDir: string,
  manifest: PluginManifest,
): Promise<void> {
  if (!isValidPluginId(manifest.id)) {
    throw new Error(`invalid plugin id '${manifest.id}'`);
  }

  // Check if plugin targets server (default true for v1 or when targets includes 'server')
  const targets = manifest.targets;
  const targetsServer = !targets || targets.includes("server");
  const entryRel = manifest.server?.entry || manifest.entry || "index.js";
  const entryPath = path.resolve(pluginDir, entryRel);
  if (
    targetsServer &&
    (path.isAbsolute(entryRel) ||
      !isInsideDirectory(path.resolve(pluginDir), entryPath))
  ) {
    throw new Error(`invalid entry path '${entryRel}'`);
  }

  // Validate the declared contract *before* importing: a dynamic import runs
  // the module's top-level code, so compatibility must be checked on the
  // manifest, not after the module has already executed.
  assertManifestCompatible(manifest);

  const registry = await host.getRegistry();
  const aggregateDigest = await registry.verifyBundle(
    pluginDir,
    manifest,
    targetsServer ? entryPath : undefined,
  );

  if (targetsServer) {
    // Version the import URL by the whole-bundle digest so a change to any
    // file (not just the entry) forces a fresh entry module instance.
    const mod = await import(
      `${pathToFileURL(entryPath).href}?v=${aggregateDigest}`
    );
    const pluginInstance = resolvePluginExport(mod);

    if (!pluginInstance) {
      throw new Error(
        `Plugin module at ${entryPath} does not export a valid ServerPlugin`,
      );
    }

    pluginInstance.metadata = {
      ...manifest,
      builtin: false,
    };

    await host.registerPlugin(pluginInstance);
  } else {
    // Client-only plugin registered for discovery and asset serving
    const clientOnlyPlugin: ServerPlugin = {
      metadata: {
        ...manifest,
        builtin: false,
      },
      init: () => {},
    };
    await host.registerPlugin(clientOnlyPlugin);
  }
}

async function readExternalManifest(
  pluginDir: string,
): Promise<string | undefined> {
  try {
    return await fs.readFile(path.join(pluginDir, "drop-plugin.json"), "utf-8");
  } catch {
    try {
      return await fs.readFile(path.join(pluginDir, "plugin.json"), "utf-8");
    } catch {
      return undefined;
    }
  }
}

async function loadExternalPluginEntry(
  host: PluginBundleHost,
  pluginDir: string,
): Promise<void> {
  const manifestContent = await readExternalManifest(pluginDir);
  if (!manifestContent) return;

  try {
    const manifest: PluginManifest = JSON.parse(manifestContent);
    if (
      !manifest.id ||
      !manifest.name ||
      !manifest.version ||
      !isValidPluginId(manifest.id)
    ) {
      host.log.warn(`Invalid plugin manifest in ${pluginDir}`);
      return;
    }

    if (host.getPlugin(manifest.id)) {
      return;
    }

    await loadExternalPluginFromDir(host, pluginDir, manifest);
  } catch (err) {
    host.log.error(`Failed to load external plugin from ${pluginDir}: ${err}`);
  }
}

/** Discover and load every external plugin bundle in the data directory. */
export async function discoverAndLoadExternalPlugins(
  host: PluginBundleHost,
): Promise<void> {
  const pluginsDir = await host.getPluginsDirectory();
  try {
    await fs.mkdir(pluginsDir, { recursive: true });
    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      await loadExternalPluginEntry(host, path.join(pluginsDir, entry.name));
    }
  } catch (err) {
    host.log.debug(`External plugins directory check: ${err}`);
  }
}

/**
 * Install (or update) a signed plugin bundle from its manifest and entry source
 * or multi-file payload, verifying checksums and signatures before loading.
 */
export async function installBundle(
  host: PluginBundleHost,
  manifest: PluginManifest,
  entryOrFiles: string | Record<string, string>,
): Promise<void> {
  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new Error("manifest requires id, name and version");
  }
  if (!isValidPluginId(manifest.id)) {
    throw new Error("invalid plugin id");
  }

  const pluginsDir = await host.getPluginsDirectory();
  const bundleDir = path.join(pluginsDir, manifest.id);
  await fs.mkdir(bundleDir, { recursive: true });

  if (typeof entryOrFiles === "string") {
    const bytes = Buffer.from(entryOrFiles, "base64");
    const digest = verifyEntryChecksum(bytes, manifest);
    (await host.getRegistry()).check(manifest, digest);

    const entryRel = manifest.entry || "index.js";
    const entryPath = path.resolve(bundleDir, entryRel);
    if (
      path.isAbsolute(entryRel) ||
      !isInsideDirectory(path.resolve(bundleDir), entryPath)
    ) {
      throw new Error("invalid entry path");
    }

    await fs.mkdir(path.dirname(entryPath), { recursive: true });
    const storedManifest: PluginManifest = {
      ...manifest,
      checksum: manifest.checksum ?? digest,
    };
    await fs.writeFile(
      path.join(bundleDir, "drop-plugin.json"),
      JSON.stringify(storedManifest, null, 2),
    );
    await fs.writeFile(entryPath, bytes);

    await loadExternalPluginFromDir(host, bundleDir, storedManifest);
  } else if (typeof entryOrFiles === "object" && entryOrFiles !== null) {
    for (const [rel, base64] of Object.entries(entryOrFiles)) {
      const resolved = path.resolve(bundleDir, rel);
      if (
        path.isAbsolute(rel) ||
        !isInsideDirectory(path.resolve(bundleDir), resolved)
      ) {
        throw new Error(`invalid bundle file path '${rel}'`);
      }
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, Buffer.from(base64, "base64"));
    }

    await fs.writeFile(
      path.join(bundleDir, "drop-plugin.json"),
      JSON.stringify(manifest, null, 2),
    );

    await loadExternalPluginFromDir(host, bundleDir, manifest);
  } else {
    throw new Error(
      "invalid bundle payload: expected base64 entry or files map",
    );
  }
}

/** Download, verify and install a plugin bundle from a remote URL. */
export async function installFromUrl(
  host: PluginBundleHost,
  url: string,
): Promise<void> {
  if (!url || typeof url !== "string") {
    throw new Error("Invalid plugin download URL");
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Unsupported protocol in URL '${url}': only http and https are allowed`,
    );
  }

  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "Drop-Plugin-Installer/1.0" },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to download plugin from '${url}': HTTP ${res.status} ${res.statusText}`,
    );
  }

  const text = await res.text();
  let bundle: {
    manifest?: PluginManifest;
    entry?: string;
    files?: Record<string, string>;
    format?: string;
  };
  try {
    bundle = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Downloaded bundle from '${url}' is not valid JSON: ${err}`,
    );
  }

  if (!bundle?.manifest || (!bundle.entry && !bundle.files)) {
    throw new Error(
      `Downloaded bundle from '${url}' missing required manifest or file payload`,
    );
  }

  const payload = bundle.files ?? bundle.entry!;
  await installBundle(host, bundle.manifest, payload);
}

/** Check installed plugins against configured registry for available updates. */
export async function checkForUpdates(
  host: PluginBundleHost,
): Promise<PluginUpdateInfo[]> {
  const registry = await host.getRegistry();
  if (!registry.enabled) {
    return [];
  }

  const results: PluginUpdateInfo[] = [];

  for (const plugin of host.listPlugins()) {
    if (plugin.builtin) continue;
    const entry = registry.getEntry(plugin.id);
    if (!entry?.version) continue;

    const hasUpdate = entry.version !== plugin.version;
    results.push({
      id: plugin.id,
      currentVersion: plugin.version,
      latestVersion: entry.version,
      hasUpdate,
      downloadUrl: entry.downloadUrl ?? entry.url,
    });
  }

  return results;
}

/** Remove an external plugin bundle and unregister it. */
export async function removeBundle(
  host: PluginBundleHost,
  id: string,
): Promise<boolean> {
  if (!isValidPluginId(id)) {
    throw new Error("invalid plugin id");
  }
  if (host.getPlugin(id)?.metadata.builtin) {
    throw new Error("cannot remove a builtin plugin");
  }

  await host.unregisterPlugin(id);

  const pluginsDir = await host.getPluginsDirectory();
  await fs.rm(path.join(pluginsDir, id), { recursive: true, force: true });
  return true;
}

/** Unload every external plugin and rediscover it from disk. */
export async function reloadPlugins(host: PluginBundleHost): Promise<void> {
  host.log.info("Reloading external plugins...");
  for (const plugin of host.listPlugins()) {
    if (!plugin.builtin) {
      await host.unregisterPlugin(plugin.id);
    }
  }
  await discoverAndLoadExternalPlugins(host);
}

/**
 * Resolve an on-disk asset for client-side bundle serving.
 * Path traversal or symlink escapes outside the plugin directory return null.
 */
export async function getClientAssetPath(
  host: PluginBundleHost,
  pluginId: string,
  assetRelPath: string,
): Promise<string | null> {
  if (!isValidPluginId(pluginId)) return null;
  const pluginDir = path.join(await host.getPluginsDirectory(), pluginId);
  const resolved = path.resolve(pluginDir, assetRelPath);
  if (!isInsideDirectory(path.resolve(pluginDir), resolved)) {
    return null;
  }
  try {
    const s = await fs.stat(resolved);
    if (s.isFile()) {
      return resolved;
    }
  } catch {
    return null;
  }
  return null;
}
