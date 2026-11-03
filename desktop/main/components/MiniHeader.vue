<template>
  <div
    class="h-16 cursor-pointer flex flex-row items-center justify-between bg-surface-950"
  >
    <div class="px-5 py-3 grow" @mousedown="() => window.startDragging()">
      <Wordmark class="mt-1" />
    </div>
    <WindowControl />
  </div>
</template>

<script setup lang="ts">
import { getCurrentWindow } from "@tauri-apps/api/window";

const window = getCurrentWindow();
</script>
