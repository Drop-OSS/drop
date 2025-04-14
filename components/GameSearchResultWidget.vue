<template>
  <div class="flex flex-row items-center gap-x-2">
    <img :src="game.icon" class="w-12 h-12 rounded-sm object-cover" >
    <div class="flex flex-col items-left">
      <h1 class="font-semibold font-display text-lg text-zinc-100">
        {{ game.name }}
        <span
          v-if="game.sourceName"
          class="inline-flex items-center rounded-md bg-blue-600/50 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-700/10"
          >{{ game.sourceName }}</span
        >
      </h1>
      <p class="text-sm text-zinc-400">{{ game.description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GameMetadataSearchResult } from "~/server/internal/metadata/types";

const props = defineProps<{
  game: GameMetadataSearchResult & { sourceName?: string };
}>();
</script>
