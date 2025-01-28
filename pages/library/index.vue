<template>
  <div class="flex flex-col p-8">
    <div class="max-w-2xl">
      <h2 class="text-2xl font-bold font-display text-zinc-100">
        Your Collections
      </h2>
      <p class="mt-2 text-zinc-400">
        Organize your games into collections for easy access.
      </p>
    </div>

    <!-- Collections grid -->
    <TransitionGroup
      name="collection-list"
      tag="div"
      class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <!-- Collection buttons (wrap each in a div for grid layout) -->
      <NuxtLink
        v-for="collection in collections"
        :key="collection.id"
        :href="`/library/collection/${collection.id}`"
        class="group relative rounded-lg bg-zinc-900/50 p-4 hover:bg-zinc-800/50 transition-all duration-200 text-left w-full"
      >
        <h3 class="text-lg font-semibold text-zinc-100">
          {{ collection.name }}
        </h3>
        <p class="mt-1 text-sm text-zinc-400">
          {{ collection.entries.length }} game(s)
        </p>

        <!-- Delete button (only show for non-default collections) -->
        <button
          v-if="!collection.isDefault"
          @click=""
          class="absolute top-1/2 -translate-y-1/2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-zinc-700/50 transition-all duration-200"
        >
          <TrashIcon class="h-5 w-5 text-zinc-400 hover:text-red-400" />
        </button>
      </NuxtLink>

      <!-- Create new collection button (also wrap in div) -->
      <div>
        <button
          @click="collectionCreateOpen = true"
          class="group relative rounded-lg border-2 border-dashed border-zinc-800 p-4 hover:border-zinc-700 hover:bg-zinc-900/30 transition-all duration-200 text-left w-full"
        >
          <div class="flex items-center gap-3">
            <PlusIcon class="h-5 w-5 text-zinc-400 group-hover:text-zinc-300" />
            <h3
              class="text-lg font-semibold text-zinc-400 group-hover:text-zinc-300"
            >
              Create Collection
            </h3>
          </div>
          <p class="mt-1 text-sm text-zinc-500">
            Add a new collection to organize your games
          </p>
        </button>
      </div>
    </TransitionGroup>
  </div>

  <CreateCollectionModal v-model="collectionCreateOpen" />
</template>

<script setup lang="ts">
import {
  ArrowTopRightOnSquareIcon,
  ArrowUpRightIcon,
  TrashIcon,
  ArrowLeftIcon,
} from "@heroicons/vue/20/solid";
import { type Game, type GameVersion } from "@prisma/client";
import { PlusIcon } from "@heroicons/vue/20/solid";

const headers = useRequestHeaders(["cookie"]);
const { data: gamesData } = await useFetch<
  (Game & { versions: GameVersion[] })[]
>("/api/v1/store/recent", { headers });
const games = ref(gamesData.value || []);

const collections = await useCollections();
const collectionCreateOpen = ref(false);

useHead({
  title: "Home",
});
</script>

<style scoped>
/* Fade transition for main content */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* List transition animations */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.list-move {
  transition: transform 0.3s ease;
}

/* Collection list transitions */
.collection-list-enter-active,
.collection-list-leave-active {
  transition: all 0.3s ease;
}

.collection-list-enter-from,
.collection-list-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Hide scrollbar for Chrome, Safari and Opera */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.no-scrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
</style>
