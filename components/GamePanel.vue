<template>
  <NuxtLink
    v-if="game"
    :href="props.href ?? `/store/${game.id}`"
    class="group relative w-48 h-64 rounded-lg overflow-hidden transition-all duration-300 text-left hover:shadow-lg"
    @click="active = game.id"
  >
    <div
      class="absolute inset-0 transition-all duration-300 group-hover:scale-105"
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
  <SkeletonCard v-else :message="$t('store.noGame')" />
</template>

<script setup lang="ts">
const props = defineProps<{
  game: StoreRenderableItem | undefined;
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
