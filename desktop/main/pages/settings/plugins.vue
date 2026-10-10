<template>
  <div class="border-b border-zinc-700 py-5 flex items-center justify-between">
    <div>
      <h3 class="text-base font-semibold font-display leading-6 text-zinc-100">
        Plugins &amp; Extensions
      </h3>
      <p class="mt-1 text-xs text-zinc-400">
        Manage installed server and client plugins, virtual mesh networks, and
        addon capabilities.
      </p>
    </div>
    <button
      type="button"
      :disabled="isLoading"
      class="inline-flex items-center gap-x-1.5 rounded-md bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition disabled:opacity-50"
      @click="reloadPlugins"
    >
      <ArrowPathIcon class="size-4" :class="{ 'animate-spin': isLoading }" />
      <span>Reload Plugins</span>
    </button>
  </div>

  <div
    v-if="error"
    class="mt-4 rounded-md bg-red-600/10 p-4 border border-red-500/20"
  >
    <div class="flex items-center gap-x-2 text-red-400 text-sm">
      <XCircleIcon class="size-5 shrink-0" />
      <span>{{ error }}</span>
    </div>
  </div>

  <div
    class="mt-6 rounded-xl border border-zinc-800 bg-zinc-850/60 p-5 space-y-3"
  >
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-zinc-100">
        Install external bundle
      </h4>
      <label
        class="cursor-pointer inline-flex items-center gap-x-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
      >
        <span>Upload .dropplugin / JSON</span>
        <input
          type="file"
          accept=".dropplugin,.json"
          class="sr-only"
          @change="handleFileUpload"
        />
      </label>
    </div>
    <p class="text-xs text-zinc-400">
      Upload a <code class="font-mono">.dropplugin</code> package, or paste
      bundle JSON:
    </p>
    <label for="install-plugin-bundle" class="sr-only"
      >External plugin bundle JSON</label
    >
    <textarea
      id="install-plugin-bundle"
      v-model="installJson"
      rows="4"
      class="w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-purple-500"
      placeholder='{"manifest":{"id":"my-plugin","name":"My Plugin","version":"1.0.0","apiVersion":2,"capabilities":["routes"]},"entry":"<base64>"}'
    ></textarea>
    <button
      type="button"
      :disabled="isLoading || !installReady"
      class="inline-flex items-center rounded-md bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition disabled:opacity-50"
      @click="handleInstallBundle"
    >
      Install
    </button>
  </div>

  <div class="mt-6 space-y-4">
    <div
      v-if="plugins.length === 0 && !isLoading"
      class="rounded-lg border border-dashed border-zinc-700 p-8 text-center"
    >
      <PuzzlePieceIcon class="mx-auto size-12 text-zinc-600 mb-2" />
      <p class="text-sm font-medium text-zinc-300">No plugins detected</p>
      <p class="text-xs text-zinc-500 mt-1">
        Installed plugins will appear here automatically.
      </p>
    </div>

    <div
      v-for="plugin in plugins"
      :key="plugin.id"
      class="rounded-xl border border-zinc-800 bg-zinc-850/60 p-5 space-y-4"
    >
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <div class="flex items-center gap-x-2">
            <h4 class="text-base font-semibold text-zinc-100">
              {{ plugin.name }}
            </h4>
            <span
              v-if="plugin.builtin"
              class="rounded bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] font-medium text-purple-300 uppercase tracking-wide"
            >
              Built-in
            </span>
            <span
              v-else
              class="rounded bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] font-medium text-blue-300 uppercase tracking-wide"
            >
              External
            </span>
            <span
              :class="[
                plugin.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : plugin.status === 'disabled'
                    ? 'bg-zinc-700/20 text-zinc-400 border-zinc-700/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30',
                'rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
              ]"
            >
              {{ plugin.status }}
            </span>
          </div>
          <p class="text-xs font-mono text-zinc-400">
            {{ plugin.id }} &bull; v{{ plugin.version }}
            <span v-if="plugin.author"> &bull; by {{ plugin.author }}</span>
          </p>
        </div>

        <div class="flex items-center gap-x-3">
          <button
            v-if="!plugin.builtin"
            type="button"
            :disabled="isLoading"
            class="text-xs font-medium text-red-400 hover:text-red-300 transition disabled:opacity-50"
            @click="handleRemovePlugin(plugin.id)"
          >
            Remove
          </button>
          <Switch
            :model-value="plugin.status === 'active'"
            :disabled="isLoading"
            :class="[
              plugin.status === 'active' ? 'bg-purple-600' : 'bg-zinc-700',
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
            ]"
            @update:model-value="(val) => handleTogglePlugin(plugin.id, val)"
          >
            <span
              :class="[
                plugin.status === 'active' ? 'translate-x-5' : 'translate-x-0',
                'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              ]"
            />
          </Switch>
        </div>
      </div>

      <p v-if="plugin.description" class="text-sm text-zinc-300">
        {{ plugin.description }}
      </p>

      <div
        v-if="plugin.capabilities && plugin.capabilities.length > 0"
        class="pt-2 border-t border-zinc-800 flex items-center gap-x-2"
      >
        <span class="text-xs text-zinc-500 flex items-center gap-x-1">
          <ShieldCheckIcon class="size-3.5 text-zinc-400" />
          Capabilities:
        </span>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="cap in plugin.capabilities"
            :key="cap"
            class="rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-300"
          >
            {{ cap }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- For Developers Section (Playnite-inspired) -->
  <div
    class="mt-8 rounded-xl border border-zinc-800 bg-zinc-850/60 p-5 space-y-3"
  >
    <div class="flex items-center justify-between">
      <div>
        <h4 class="text-sm font-semibold text-zinc-100">
          For Developers: Load Unpacked Plugin
        </h4>
        <p class="text-xs text-zinc-400">
          Load a development plugin bundle directly from a local path without
          packaging.
        </p>
      </div>
      <span
        class="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium text-amber-300 uppercase tracking-wide"
      >
        Developer Mode
      </span>
    </div>
    <div class="flex gap-x-2">
      <input
        v-model="devPluginPath"
        type="text"
        aria-label="Development plugin path"
        class="flex-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-purple-500"
        placeholder="/path/to/my-plugin/dist/client/index.js"
      />
      <button
        type="button"
        :disabled="isLoading || !devPluginPath.trim()"
        class="inline-flex items-center rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition disabled:opacity-50"
        @click="handleLoadDevPlugin"
      >
        Load
      </button>
    </div>
  </div>

  <div class="mt-8 space-y-4">
    <h4 class="text-sm font-semibold text-zinc-100">Extension Settings</h4>
    <PluginSlot name="settings:tabs" />
  </div>

  <!-- Capability Review / Permission Consent Modal -->
  <div
    v-if="showConsentModal && pendingInstall"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
  >
    <div
      class="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl space-y-4"
    >
      <div class="flex items-center gap-x-2 text-purple-400">
        <ShieldCheckIcon class="size-6" />
        <h3 class="text-base font-semibold text-zinc-100">
          Review Plugin Permissions
        </h3>
      </div>
      <p class="text-xs text-zinc-400">
        <strong class="text-zinc-200">{{
          pendingInstall.manifest?.name ||
          pendingInstall.entry ||
          "Unknown Plugin"
        }}</strong>
        (<code>{{ pendingInstall.manifest?.id || "unknown" }}</code> v{{
          pendingInstall.manifest?.version || "0.0.0"
        }}) requests the following capabilities:
      </p>
      <div
        class="max-h-60 overflow-y-auto space-y-2 rounded-lg bg-zinc-950 p-3 border border-zinc-800"
      >
        <div
          v-for="cap in pendingInstall.manifest?.capabilities || []"
          :key="cap"
          class="flex flex-col text-xs"
        >
          <span class="font-mono font-semibold text-purple-300">{{ cap }}</span>
          <span class="text-zinc-400 text-[11px]">{{
            CAPABILITY_DESCRIPTIONS[cap] || "Standard plugin capability"
          }}</span>
        </div>
      </div>
      <div class="flex justify-end gap-x-2 pt-2">
        <button
          type="button"
          class="rounded-md bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition"
          @click="
            showConsentModal = false;
            pendingInstall = null;
          "
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-md bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition"
          @click="confirmInstall(pendingInstall)"
        >
          Authorize &amp; Install
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Switch } from "@headlessui/vue";
import {
  ArrowPathIcon,
  PuzzlePieceIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "@heroicons/vue/20/solid";
import { invoke } from "@tauri-apps/api/core";
import { clientPluginManager } from "~/internal/plugins/ClientPluginManager";

const devPluginPath = ref("");

async function handleLoadDevPlugin() {
  if (!devPluginPath.value.trim()) return;
  isLoading.value = true;
  error.value = null;
  try {
    const p = devPluginPath.value.trim();
    await clientPluginManager.loadFromUrl("dev-plugin", p);
    devPluginPath.value = "";
  } catch (e) {
    error.value = `Failed to load dev plugin: ${e}`;
  } finally {
    isLoading.value = false;
  }
}

export interface PluginItem {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  builtin?: boolean;
  capabilities?: string[];
  status: "active" | "disabled" | "error";
  error?: string;
}

const plugins = ref<PluginItem[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

async function fetchPlugins() {
  isLoading.value = true;
  error.value = null;
  try {
    const res = await invoke<{ plugins: PluginItem[] }>("plugin_request", {
      pluginId: "",
      method: "GET",
      path: "",
    });
    plugins.value = res.plugins ?? [];
  } catch (e) {
    error.value = (e as string).toString();
  } finally {
    isLoading.value = false;
  }
}

async function handleTogglePlugin(id: string, enabled: boolean) {
  isLoading.value = true;
  error.value = null;
  try {
    await invoke("plugin_request", {
      pluginId: `${id}/state`,
      method: "PATCH",
      path: "",
      body: { enabled },
    });
    await fetchPlugins();
  } catch (e) {
    error.value = (e as string).toString();
  } finally {
    isLoading.value = false;
  }
}

async function reloadPlugins() {
  isLoading.value = true;
  error.value = null;
  try {
    await invoke("plugin_request", {
      pluginId: "reload",
      method: "POST",
      path: "",
    });
    await fetchPlugins();
  } catch (e) {
    error.value = (e as string).toString();
  } finally {
    isLoading.value = false;
  }
}

async function handleRemovePlugin(id: string) {
  isLoading.value = true;
  error.value = null;
  try {
    await invoke("plugin_request", {
      pluginId: `${id}/bundle`,
      method: "DELETE",
      path: "",
    });
    await fetchPlugins();
  } catch (e) {
    error.value = (e as string).toString();
  } finally {
    isLoading.value = false;
  }
}

interface InstallPayload {
  manifest?: {
    id?: string;
    name?: string;
    version?: string;
    capabilities?: string[];
  };
  entry?: string;
  files?: Record<string, string>;
  format?: string;
  signature?: string;
}

const installJson = ref("");
const installReady = computed(() => installJson.value.trim().length > 0);
const showConsentModal = ref(false);
const pendingInstall = ref<InstallPayload | null>(null);

const CAPABILITY_DESCRIPTIONS: Record<string, string> = {
  "game:fs":
    "Confined filesystem access within active game installation directories.",
  "game:launch-hook":
    "Execute pre-launch validation and post-exit launch pipeline hooks.",
  "game:scan": "Scan executables and perform anti-cheat compatibility checks.",
  "ui:play-action":
    "Inject custom startup actions and play modes into game launch menus.",
  "ui:slot": "Contribute UI panels, sidebar tabs, and status badges.",
  "ui:context-menu": "Add custom action items to game context menus.",
  "ui:sidebar": "Add items and progress indicators to the client sidebar.",
  "ui:topbar": "Add status indicators to the top application bar.",
  "client:storage": "Store client-side settings and metadata.",
  "client:ws": "Communicate with backend WebSocket channels.",
  routes: "Register custom HTTP routes on the server.",
  storage: "Access persistent server storage.",
  events: "Broadcast and listen to server event bus messages.",
  network: "Make outbound network requests from the server.",
  websocket: "Expose real-time WebSocket communication channels.",
  "system:sidecar": "Execute background system sidecar processes.",
  "system:command":
    "Run allowlisted native CLI commands on this device.",
};

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  installJson.value = await file.text();
}

function handleInstallBundle() {
  error.value = null;
  try {
    const parsed = JSON.parse(installJson.value) as InstallPayload;
    if (!parsed?.manifest || (!parsed.entry && !parsed.files)) {
      throw new Error(
        'Bundle must contain a "manifest" and either an "entry" or "files" map',
      );
    }

    const caps = parsed.manifest.capabilities || [];
    if (caps.length > 0) {
      pendingInstall.value = parsed;
      showConsentModal.value = true;
    } else {
      confirmInstall(parsed);
    }
  } catch (e) {
    error.value = (e as string).toString();
  }
}

async function confirmInstall(payload: InstallPayload) {
  isLoading.value = true;
  error.value = null;
  showConsentModal.value = false;
  try {
    await invoke("plugin_request", {
      pluginId: "install",
      method: "POST",
      path: "",
      body: payload,
    });
    installJson.value = "";
    pendingInstall.value = null;
    await fetchPlugins();
  } catch (e) {
    error.value = (e as string).toString();
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchPlugins();
});
</script>
