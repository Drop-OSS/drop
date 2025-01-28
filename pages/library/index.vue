<template>
  <div class="flex flex-col">
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
      class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <!-- Collection buttons (wrap each in a div for grid layout) -->
      <div
        v-for="collection in collections"
        :key="collection.id"
        class="flex flex-row rounded-lg overflow-hidden transition-all duration-200 text-left w-full hover:scale-105"
      >
        <NuxtLink
          class="grow p-4 bg-zinc-800/50 hover:bg-zinc-800"
          :href="`/library/collection/${collection.id}`"
        >
          <h3 class="text-lg font-semibold text-zinc-100">
            {{ collection.name }}
          </h3>
          <p class="mt-1 text-sm text-zinc-400">
            {{ collection.entries.length }} game(s)
          </p>
        </NuxtLink>

        <!-- Delete button (only show for non-default collections) -->
        <button
          @click="() => (currentlyDeleting = collection)"
          class="group px-3 ml-[2px] bg-zinc-800/50 hover:bg-zinc-800 group"
        >
          <TrashIcon class="transition-all size-5 text-zinc-400 group-hover:text-red-400 group-hover:rotate-[8deg]" />
        </button>
      </div>

      <!-- Create new collection button (also wrap in div) -->
      <div>
        <button
          @click="collectionCreateOpen = true"
          class="group flex flex-row rounded-lg overflow-hidden transition-all duration-200 text-left w-full hover:scale-105"
        >
          <div class="grow p-4 bg-zinc-800/50 hover:bg-zinc-800 border-2 border-dashed border-zinc-700">
            <div class="flex items-center gap-3">
              <PlusIcon class="h-5 w-5 text-zinc-400 group-hover:text-zinc-300 transition-all duration-300 group-hover:rotate-90" />
              <h3 class="text-lg font-semibold text-zinc-400 group-hover:text-zinc-300">
                Create Collection
              </h3>
            </div>
            <p class="mt-1 text-sm text-zinc-500 group-hover:text-zinc-400">
              Add a new collection to organize your games
            </p>
          </div>
        </button>
      </div>
    </TransitionGroup>
  </div>

  <CreateCollectionModal v-model="collectionCreateOpen" />
  <DeleteCollectionModal v-model="currentlyDeleting" />
</template>

<script setup lang="ts">
import {
  ArrowTopRightOnSquareIcon,
  ArrowUpRightIcon,
  TrashIcon,
  ArrowLeftIcon,
} from "@heroicons/vue/20/solid";
import { type Collection, type Game, type GameVersion } from "@prisma/client";
import { PlusIcon } from "@heroicons/vue/20/solid";

const headers = useRequestHeaders(["cookie"]);
const { data: gamesData } = await useFetch<
  (Game & { versions: GameVersion[] })[]
>("/api/v1/store/recent", { headers });

const collections = await useCollections();
const collectionCreateOpen = ref(false);

const currentlyDeleting = ref<Collection | undefined>();

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
