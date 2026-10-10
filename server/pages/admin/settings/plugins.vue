<template>
  <div class="w-full max-w-4xl space-y-6">
    <div
      class="border-b border-white/10 pb-5 flex items-center justify-between"
    >
      <div>
        <h3 class="text-base font-semibold leading-6 text-white">
          Plugins &amp; Extensions
        </h3>
        <p class="mt-1 text-sm text-zinc-400">
          Manage server-side and client extensions, community providers, and
          addon capabilities.
        </p>
      </div>
      <div class="flex items-center gap-x-2">
        <button
          type="button"
          :disabled="isLoading"
          class="inline-flex items-center gap-x-1.5 rounded-md bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition disabled:opacity-50"
          @click="checkUpdates"
        >
          <ArrowPathIcon
            class="size-4"
            :class="{ 'animate-spin': isCheckingUpdates }"
          />
          <span>Check Updates</span>
        </button>
        <button
          type="button"
          :disabled="isLoading"
          class="inline-flex items-center gap-x-1.5 rounded-md bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition disabled:opacity-50"
          @click="reloadPlugins"
        >
          <ArrowPathIcon
            class="size-4"
            :class="{ 'animate-spin': isReloading }"
          />
          <span>Reload</span>
        </button>
      </div>
    </div>

    <!-- Error Banner -->
    <div
      v-if="errorMessage"
      class="rounded-md bg-red-600/10 p-4 border border-red-500/20"
    >
      <div class="flex items-center gap-x-2 text-red-400 text-sm">
        <XCircleIcon class="size-5 shrink-0" />
        <span>{{ errorMessage }}</span>
      </div>
    </div>

    <!-- Success Banner -->
    <div
      v-if="successMessage"
      class="rounded-md bg-green-600/10 p-4 border border-green-500/20"
    >
      <div class="flex items-center gap-x-2 text-green-400 text-sm">
        <CheckCircleIcon class="size-5 shrink-0" />
        <span>{{ successMessage }}</span>
      </div>
    </div>

    <!-- Install Plugin Section -->
    <div class="rounded-xl border border-white/10 bg-zinc-900/60 p-5 space-y-4">
      <h4 class="text-sm font-semibold text-white">Install Plugin Bundle</h4>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <!-- Install by URL -->
        <div class="space-y-2">
          <label
            for="plugin-url-input"
            class="block text-xs font-medium text-zinc-300"
            >Install from URL</label
          >
          <div class="flex gap-x-2">
            <input
              id="plugin-url-input"
              v-model="installUrl"
              type="url"
              placeholder="https://.../my-plugin.dropplugin"
              aria-label="Install from URL"
              class="block w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              :disabled="isLoading || !installUrl.trim()"
              class="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
              @click="handleInstallUrl"
            >
              Install
            </button>
          </div>
        </div>

        <!-- Install by File Upload -->
        <div class="space-y-2">
          <label
            for="plugin-file-upload"
            class="block text-xs font-medium text-zinc-300"
            >Upload Package File</label
          >
          <label
            for="plugin-file-upload"
            class="inline-flex cursor-pointer items-center justify-center gap-x-2 w-full rounded-md bg-zinc-800 border border-zinc-700 border-dashed px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-750 transition"
          >
            <ArrowUpTrayIcon class="size-4 text-zinc-400" />
            <span>{{
              uploadFileName || "Select .dropplugin or bundle .json"
            }}</span>
            <input
              id="plugin-file-upload"
              type="file"
              accept=".dropplugin,.json"
              aria-label="Upload Package File"
              class="sr-only"
              @change="handleFileUpload"
            />
          </label>
        </div>
      </div>
    </div>

    <!-- Plugin List -->
    <div class="space-y-3">
      <h4 class="text-sm font-semibold text-white">
        Installed Plugins ({{ plugins.length }})
      </h4>

      <div
        v-if="plugins.length === 0"
        class="rounded-lg border border-dashed border-zinc-700 p-8 text-center"
      >
        <PuzzlePieceIcon class="mx-auto size-12 text-zinc-600 mb-2" />
        <p class="text-sm font-medium text-zinc-300">No plugins installed</p>
        <p class="text-xs text-zinc-500 mt-1">
          Installed bundles in the data folder will appear here automatically.
        </p>
      </div>

      <div
        v-for="plugin in plugins"
        :key="plugin.id"
        class="rounded-xl border border-white/10 bg-zinc-900/60 p-5 space-y-3"
      >
        <div class="flex items-start justify-between">
          <div class="space-y-1">
            <div class="flex items-center gap-x-2">
              <h5 class="text-sm font-semibold text-white">
                {{ plugin.name }}
              </h5>
              <span
                v-if="plugin.builtin"
                class="rounded bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] font-medium text-purple-300 uppercase tracking-wide"
              >
                Builtin
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
            <p v-if="plugin.description" class="text-xs text-zinc-300 mt-1">
              {{ plugin.description }}
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
            <button
              type="button"
              :disabled="isLoading"
              :class="[
                plugin.status === 'active'
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600',
                'rounded px-2.5 py-1 text-xs font-medium transition disabled:opacity-50',
              ]"
              @click="handleTogglePlugin(plugin.id, plugin.status !== 'active')"
            >
              {{ plugin.status === "active" ? "Disable" : "Enable" }}
            </button>
          </div>
        </div>

        <!-- Capabilities -->
        <div
          v-if="plugin.capabilities?.length"
          class="flex flex-wrap gap-1.5 pt-2 border-t border-white/5"
        >
          <span
            v-for="cap in plugin.capabilities"
            :key="cap"
            class="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400"
          >
            {{ cap }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  PuzzlePieceIcon,
  XCircleIcon,
} from "@heroicons/vue/24/outline";

definePageMeta({
  layout: "admin",
});

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  builtin?: boolean;
  status: "active" | "disabled" | "error" | "registered";
  capabilities?: string[];
}

const plugins = ref<PluginInfo[]>([]);
const isLoading = ref(false);
const isReloading = ref(false);
const isCheckingUpdates = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const installUrl = ref("");
const uploadFileName = ref("");

function getErrorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

async function loadPlugins() {
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const res = await $dropFetch<{ plugins: PluginInfo[] }>("/api/v1/plugins");
    plugins.value = res.plugins || [];
  } catch (err: unknown) {
    errorMessage.value = getErrorMessage(err, "Failed to load plugins");
  } finally {
    isLoading.value = false;
  }
}

async function reloadPlugins() {
  isReloading.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  try {
    const res = await $dropFetch<{ plugins: PluginInfo[] }>(
      "/api/v1/plugins/reload",
      {
        method: "POST",
      },
    );
    plugins.value = res.plugins || [];
    successMessage.value = "Plugins reloaded successfully";
  } catch (err: unknown) {
    errorMessage.value = getErrorMessage(err, "Failed to reload plugins");
  } finally {
    isReloading.value = false;
  }
}

async function checkUpdates() {
  isCheckingUpdates.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  try {
    const res = await $dropFetch<{
      updates: Array<{
        id: string;
        currentVersion: string;
        latestVersion: string;
        hasUpdate: boolean;
      }>;
    }>("/api/v1/plugins/updates");
    const updates = res.updates?.filter((u) => u.hasUpdate) || [];
    if (updates.length > 0) {
      const updateList = updates
        .map((u) => `${u.id} (v${u.latestVersion})`)
        .join(", ");
      successMessage.value = `${updates.length} update(s) available: ${updateList}`;
    } else {
      successMessage.value = "All plugins are up to date";
    }
  } catch (err: unknown) {
    errorMessage.value = getErrorMessage(
      err,
      "Failed to check for plugin updates",
    );
  } finally {
    isCheckingUpdates.value = false;
  }
}

async function handleTogglePlugin(id: string, enabled: boolean) {
  isLoading.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  try {
    await $dropFetch(`/api/v1/plugins/${id}/state`, {
      method: "PATCH",
      body: { enabled },
    });
    await loadPlugins();
    successMessage.value = `Plugin '${id}' ${enabled ? "enabled" : "disabled"}`;
  } catch (err: unknown) {
    errorMessage.value = getErrorMessage(
      err,
      `Failed to update plugin '${id}' state`,
    );
  } finally {
    isLoading.value = false;
  }
}

async function handleRemovePlugin(id: string) {
  if (!confirm(`Are you sure you want to remove plugin '${id}'?`)) {
    return;
  }
  isLoading.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  try {
    const res = await $dropFetch<{ plugins: PluginInfo[] }>(
      `/api/v1/plugins/${id}/bundle`,
      {
        method: "DELETE",
      },
    );
    plugins.value = res.plugins || [];
    successMessage.value = `Plugin '${id}' removed successfully`;
  } catch (err: unknown) {
    errorMessage.value = getErrorMessage(
      err,
      `Failed to remove plugin '${id}'`,
    );
  } finally {
    isLoading.value = false;
  }
}

async function handleInstallUrl() {
  if (!installUrl.value.trim()) return;
  isLoading.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  try {
    const res = await $dropFetch<{ plugins: PluginInfo[] }>(
      "/api/v1/plugins/install",
      {
        method: "POST",
        body: { url: installUrl.value.trim() },
      },
    );
    plugins.value = res.plugins || [];
    installUrl.value = "";
    successMessage.value = "Plugin installed successfully from URL";
  } catch (err: unknown) {
    errorMessage.value = getErrorMessage(
      err,
      "Failed to install plugin from URL",
    );
  } finally {
    isLoading.value = false;
  }
}

async function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  uploadFileName.value = file.name;
  isLoading.value = true;
  errorMessage.value = null;
  successMessage.value = null;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const body =
      payload.format === "dropplugin-v2"
        ? { manifest: payload.manifest, files: payload.files }
        : payload;

    const res = await $dropFetch<{ plugins: PluginInfo[] }>(
      "/api/v1/plugins/install",
      {
        method: "POST",
        body,
      },
    );
    plugins.value = res.plugins || [];
    uploadFileName.value = "";
    successMessage.value = `Successfully installed '${file.name}'`;
  } catch (err: unknown) {
    errorMessage.value = getErrorMessage(
      err,
      `Failed to install from file '${file.name}'`,
    );
  } finally {
    isLoading.value = false;
    target.value = "";
  }
}

await loadPlugins();
</script>
