<template>
  <NuxtLink
    v-if="game"
    :href="props.href ?? `/store/${game.id}`"
    class="group relative w-48 h-64 rounded-lg overflow-hidden transition-all duration-300 text-left hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5"
    @click.native="active = game.id"
  >
    <div
      class="absolute inset-0 transition-all duration-300 group-hover:scale-110"
    >
      <img
        :src="useObject(game.mCoverId)"
        class="w-full h-full object-cover brightness-[90%]"
        :class="{ active: active === game.id }"
        :alt="game.mName"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/20 to-transparent"
      />
    </div>

    <div class="absolute bottom-0 left-0 w-full p-3">
      <h1
        class="text-zinc-100 text-sm font-bold font-display group-hover:text-white transition-colors"
      >
        {{ game.mName }}
      </h1>
      <p
        class="text-zinc-400 text-xs line-clamp-2 group-hover:text-zinc-300 transition-colors"
      >
        {{ game.mShortDescription }}
      </p>
    </div>
  </NuxtLink>
  <div
    v-else
    class="rounded-lg w-48 h-64 bg-zinc-800/50 flex items-center justify-center transition-all duration-300 hover:bg-zinc-800"
  >
    <p class="text-zinc-700 text-sm font-semibold font-display uppercase">
      no game
    </p>
  </div>
</template>

<script setup lang="ts">
import type { SerializeObject } from "nitropack";

const props = defineProps<{
  game:
    | SerializeObject<{
        id: string;
        mCoverId: string;
        mName: string;
        mShortDescription: string;
      }>
    | undefined;
  href?: string;
}>();

const active = useState();
</script>

<style scoped>
img.active {
  view-transition-name: selected-game;
  contain: layout;
}
</style>
