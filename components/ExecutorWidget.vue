<template>
  <div
    v-if="executor"
    class="flex space-x-4 rounded-md bg-zinc-900/50 px-6 outline -outline-offset-1 outline-white/10 w-fit text-xs font-bold text-zinc-100"
  >
    <div class="inline-flex gap-x-2 items-center">
      <img :src="executor.gameIcon" class="size-6" />
      <span>{{ executor.gameName }}</span>
    </div>
    <div class="flex items-center">
      <svg
        class="h-full w-6 shrink-0 text-white/10"
        viewBox="0 0 24 44"
        preserveAspectRatio="none"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
      </svg>
      <span class="ml-4">{{ executor.versionName }}</span>
    </div>
    <div class="flex items-center">
      <svg
        class="h-full w-6 shrink-0 text-white/10"
        viewBox="0 0 24 44"
        preserveAspectRatio="none"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
      </svg>
      <span class="ml-4 truncate">{{ executor.launchName }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ExecutorLaunchObject } from "~/composables/frontend";

defineProps<{ executor: ExecutorLaunchObject }>();
</script>
