<script setup lang="ts">
import { ArrowDownTrayIcon, CloudIcon } from "@heroicons/vue/20/solid";
import { invoke } from "@tauri-apps/api/core";

async function checkOffline() {
  const isOffline = await invoke("check_online");
}
</script>

<template>
  <button
    @click="checkOffline"
    class="transition inline-flex items-center rounded-sm px-4 py-1.5 bg-surface-900 text-sm text-ink-400 gap-x-2"
  >
    <div class="relative">
      <CloudIcon class="h-5 z-50 text-ink-500" />
      <div
        class="absolute rounded-full left-1/2 top-1/2 -translate-y-[45%] -translate-x-1/2 w-[2px] h-6 rotate-[45deg] bg-surface-400 z-50"
      />
    </div>
    Offline
  </button>
</template>
