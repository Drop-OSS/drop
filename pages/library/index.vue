<template>
  <div>
    <div class="flex flex-col gap-y-8">
      <div class="max-w-2xl">
        <h2 class="text-2xl font-bold font-display text-zinc-100">Library</h2>
        <p class="mt-2 text-zinc-400">
          Organize your games into collections for easy access, and access all
          your games.
        </p>
      </div>

      <!-- Collections grid -->
      <TransitionGroup
        name="collection-list"
        tag="div"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <!-- Collection buttons (wrap each in a div for grid layout) -->
        <div
          v-for="collection in collections"
          :key="collection.id"
          class="flex flex-row rounded-lg overflow-hidden transition-all duration-200 text-left w-full hover:scale-105 focus:scale-105"
        >
          <NuxtLink
            class="grow p-4 bg-zinc-800/50 hover:bg-zinc-800 focus:bg-zinc-800 focus:outline-none"
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
            class="group px-3 ml-[2px] bg-zinc-800/50 hover:bg-zinc-800 group focus:bg-zinc-800 focus:outline-none"
            @click="() => (currentlyDeleting = collection)"
          >
            <TrashIcon
              class="transition-all size-5 text-zinc-400 group-hover:text-red-400 group-hover:rotate-[8deg]"
            />
          </button>
        </div>

        <!-- Create new collection button (also wrap in div) -->
        <div>
          <button
            class="group flex flex-row rounded-lg overflow-hidden transition-all duration-200 text-left w-full hover:scale-105"
            @click="collectionCreateOpen = true"
          >
            <div
              class="grow p-4 bg-zinc-800/50 hover:bg-zinc-800 border-2 border-dashed border-zinc-700"
            >
              <div class="flex items-center gap-3">
                <PlusIcon
                  class="h-5 w-5 text-zinc-400 group-hover:text-zinc-300 transition-all duration-300 group-hover:rotate-90"
                />
                <h3
                  class="text-lg font-semibold text-zinc-400 group-hover:text-zinc-300"
                >
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

      <!-- game library grid -->
      <div>
        <h1 class="text-zinc-100 text-xl font-bold font-display">All Games</h1>
        <div class="mt-4 flex flex-row flex-wrap justify-left gap-4">
          <GamePanel
            v-for="game in games"
            :key="game.id"
            :game="game"
            :href="`/library/game/${game?.id}`"
          />
        </div>
      </div>
    </div>

    <CreateCollectionModal v-model="collectionCreateOpen" />
    <DeleteCollectionModal v-model="currentlyDeleting" />
  </div>
</template>

<script setup lang="ts">
import { TrashIcon, PlusIcon } from "@heroicons/vue/20/solid";
import type { Collection } from "~/prisma/client";

const collections = await useCollections();
const collectionCreateOpen = ref(false);

const currentlyDeleting = ref<Collection | undefined>();

const library = await useLibrary();
const games = library.value.entries.map((e) => e.game);

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
