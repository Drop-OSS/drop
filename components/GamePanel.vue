<template>
  <NuxtLink
    v-if="game"
    :href="`/store/${game.id}`"
    class="rounded overflow-hidden w-48 h-64 group relative transition-all duration-300 text-left"
  >
    <img :src="useObject(game.mCoverId)" class="w-full h-full object-cover" />
    <div
      class="absolute inset-0 bg-gradient-to-b from-transparent to-95% to-zinc-950"
    />
    <div class="absolute bottom-0 left-0 px-2 py-1.5">
      <h1 class="text-zinc-100 text-sm font-bold font-display">
        {{ game.mName }}
      </h1>
      <p class="text-zinc-400 text-xs line-clamp-2">
        {{ game.mShortDescription }}
      </p>
    </div>
  </NuxtLink>
  <div
    v-else
    class="rounded w-48 h-64 bg-zinc-800 flex items-center justify-center"
  >
    <p class="text-zinc-700 text-sm font-semibold font-display uppercase">
      no game
    </p>
  </div>
</template>

<script setup lang="ts">
import type { SerializeObject } from "nitropack";

const props = defineProps<{
  game?: SerializeObject<{
    id: string;
    mCoverId: string;
    mName: string;
    mShortDescription: string;
  }>;
}>();
</script>
