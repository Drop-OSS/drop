<template>
  <NuxtLink
    v-if="game"
    :href="href"
    v-bind:class="{
      'transition-all duration-300 text-left hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5':
        animate,
    }"
    class="group relative w-48 h-64 rounded-lg overflow-hidden"
    @click="active = game.id"
  >
    <div
      v-bind:class="{
        'transition-all duration-300 group-hover:scale-110': animate,
      }"
      class="absolute inset-0"
    >
      <img
        :src="useObject(game.mCoverObjectId)"
        class="w-full h-full object-cover brightness-[90%]"
        :class="{ active: active === game.id }"
        :alt="game.mName"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/20 to-transparent"
      />
    </div>

    <div
      v-if="showTitleDescription"
      class="absolute bottom-0 left-0 w-full p-3"
    >
      <h1
        v-bind:class="{ 'group-hover:text-white transition-colors': animate }"
        class="text-zinc-100 text-sm font-bold font-display"
      >
        {{ game.mName }}
      </h1>
      <p
        v-bind:class="{
          'group-hover:text-zinc-300 transition-colors': animate,
        }"
        class="text-zinc-400 text-xs line-clamp-2"
      >
        {{ game.mShortDescription }}
      </p>
    </div>
  </NuxtLink>
  <SkeletonCard v-else :message="$t('store.noGame')" />
</template>

<script setup lang="ts">
import type { SerializeObject } from "nitropack";

const {
  game,
  href = undefined,
  showTitleDescription = true,
  animate = true,
} = defineProps<{
  game:
    | SerializeObject<{
        id: string;
        mCoverObjectId: string;
        mName: string;
        mShortDescription: string;
      }>
    | undefined;
  href?: string;
  showTitleDescription?: boolean;
  animate?: boolean;
}>();

const active = useState();
</script>

<style scoped>
img.active {
  view-transition-name: selected-game;
  contain: layout;
}
</style>
