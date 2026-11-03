<template>
  <div class="divide-y divide-surface-700">
    <div class="py-6">
      <h2 class="text-base font-semibold font-display leading-7 text-ink-100">
        Debug Information
      </h2>
      <p class="mt-1 text-sm leading-6 text-ink-400">
        Technical information about your Drop client installation, helpful for
        debugging.
      </p>

      <div class="mt-10 space-y-8">
        <div>
          <div class="flex items-center gap-x-3">
            <FingerPrintIcon class="h-5 w-5 text-ink-400" />
            <h3 class="text-sm font-medium leading-6 text-ink-100">
              Client ID
            </h3>
          </div>
          <p class="mt-2 text-sm text-ink-400 font-mono ml-8">
            {{ clientId || "Not signed in" }}
          </p>
        </div>

        <div>
          <div class="flex items-center gap-x-3">
            <ComputerDesktopIcon class="h-5 w-5 text-ink-400" />
            <h3 class="text-sm font-medium leading-6 text-ink-100">
              Platform
            </h3>
          </div>
          <p class="mt-2 text-sm text-ink-400 font-mono ml-8">
            {{ platformInfo }}
          </p>
        </div>

        <div>
          <div class="flex items-center gap-x-3">
            <ServerIcon class="h-5 w-5 text-ink-400" />
            <h3 class="text-sm font-medium leading-6 text-ink-100">
              Server URL
            </h3>
          </div>
          <p class="mt-2 text-sm text-ink-400 font-mono ml-8">
            {{ baseUrl || "Not connected" }}
          </p>
        </div>

        <div>
          <div class="flex items-center gap-x-3">
            <FolderIcon class="h-5 w-5 text-ink-400" />
            <h3 class="text-sm font-medium leading-6 text-ink-100">
              Data Directory
            </h3>
          </div>
          <p class="mt-2 text-sm text-ink-400 font-mono ml-8">
            {{ dataDir || "Unknown" }}
          </p>
        </div>

        <div class="pt-6 flex gap-x-4">
          <button
            @click="() => openDataDir()"
            type="button"
            class="inline-flex items-center gap-x-2 rounded-md bg-accent-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          >
            <FolderIcon class="h-5 w-5" aria-hidden="true" />
            Open Data Directory
          </button>
          <button
            @click="() => openLogFile()"
            type="button"
            class="inline-flex items-center gap-x-2 rounded-md bg-accent-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          >
            <DocumentTextIcon class="h-5 w-5" aria-hidden="true" />
            Open Log File
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { platform, type } from "@tauri-apps/plugin-os";
import {
  FingerPrintIcon,
  TagIcon,
  ComputerDesktopIcon,
  ServerIcon,
  FolderIcon,
  CubeIcon,
  DocumentTextIcon,
} from "@heroicons/vue/24/outline";
import { open } from "@tauri-apps/plugin-shell";

const clientId = ref<string | null>(null);
const platformInfo = ref("Loading...");
const baseUrl = ref<string | null>(null);
const dataDir = ref<string | null>(null);

const systemData = await invoke<{
  clientId: string;
  baseUrl: string;
  dataDir: string;
}>("fetch_system_data");

clientId.value = systemData.clientId;
baseUrl.value = systemData.baseUrl;
dataDir.value = systemData.dataDir;

const currentPlatform = await platform();
platformInfo.value = currentPlatform;

async function openDataDir() {
  if (!dataDir.value) return;
  try {
    await invoke("open_fs", { path: dataDir.value });
  } catch (error) {
    console.error("Failed to open data dir:", error);
  }
}

async function openLogFile() {
  if (!dataDir.value) return;
  try {
    const logPath = `${dataDir.value}/drop.log`;
    await invoke("open_fs", { path: logPath });
  } catch (error) {
    console.error("Failed to open log file:", error);
  }
}
</script>
