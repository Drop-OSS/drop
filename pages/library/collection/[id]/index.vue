<template>
  <div class="flex flex-col">
    <div class="max-w-2xl">
      <div class="flex items-center gap-x-3 mb-4">
        <NuxtLink
          to="/library"
          class="transition text-sm/6 font-semibold text-zinc-400 hover:text-zinc-100 inline-flex gap-x-2 items-center duration-200 hover:scale-105"
        >
          <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
          Back to Library
        </NuxtLink>
      </div>
      <h2 class="text-2xl font-bold font-display text-zinc-100">
        {{ collection?.name }}
      </h2>
      <p class="mt-2 text-zinc-400">
        {{ collection?.entries?.length || 0 }} games
      </p>
    </div>

    <!-- Games grid -->
    <div
      class="mt-4 flex flex-row gap-4 flex-wrap justify-center sm:justify-start"
    >
      <GamePanel
        v-for="entry in collection?.entries"
        :game="entry.game"
        :href="`/library/game/${entry.game.id}`"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeftIcon, TrashIcon } from "@heroicons/vue/20/solid";

const route = useRoute();
const collections = await useCollections();
const collection = computed(() =>
  collections.value.find((e) => e.id == route.params.id)
);
if (collection.value === undefined) {
  throw createError({ statusCode: 404, statusMessage: "Collection not found" });
}

useHead({
  title: collection.value?.name || "Collection",
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
