<template>
  <div class="flex flex-col p-8">
    <div class="max-w-2xl">
      <div class="flex items-center gap-x-3 mb-4">
        <NuxtLink 
          to="/library"
          class="inline-flex items-center gap-x-2 rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white shadow-sm hover:bg-zinc-700 transition-all duration-200"
        >
          <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
          Back to Collections
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
    <div class="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      <NuxtLink 
        v-for="entry in collection?.entries" 
        :key="entry.game.id"
        :to="`/library/game/${entry.game.id}`"
        class="group relative h-32 rounded-lg overflow-hidden hover:scale-[1.02] transition-all duration-200"
      >
        <!-- Blurred banner background -->
        <div class="absolute inset-0 transition-all duration-300 group-hover:scale-110">
          <img 
            :src="useObject(entry.game.mBannerId)"
            class="w-full h-full object-cover blur-[2px] brightness-[40%]"
            alt=""
          />
          <div class="absolute inset-0 bg-gradient-to-r from-zinc-950/60 to-transparent" />
        </div>
        
        <!-- Game content -->
        <div class="relative h-full flex items-center p-6">
          <div>
            <h3 class="text-xl font-bold font-display text-zinc-100">
              {{ entry.game.mName }}
            </h3>
            <p class="mt-2 text-sm text-zinc-300 line-clamp-2 max-w-xl">
              {{ entry.game.mShortDescription }}
            </p>
          </div>
        </div>

        <!-- Delete button -->
        <button
          @click.prevent.stop="removeGameFromCollection(entry.game.id)"
          class="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-zinc-700/50 transition-all duration-200 text-zinc-400 hover:text-red-400"
        >
          <TrashIcon class="h-5 w-5" aria-hidden="true" />
        </button>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeftIcon, TrashIcon } from "@heroicons/vue/20/solid";
import { type Collection, type Game, type GameVersion } from "@prisma/client";

const route = useRoute();
const headers = useRequestHeaders(["cookie"]);

// Define the type for collection with entries and full game data
type CollectionWithEntries = Collection & {
  entries: {
    game: Game & {
      versions: GameVersion[];
    };
  }[];
};

// Fetch collection data with entries using the route parameter
const { data: collection } = await useFetch<CollectionWithEntries>(`/api/v1/collection/${route.params.id}`, {
  headers,
  transform: (collection) => {
    if (!collection) return null;
    return collection as CollectionWithEntries;
  }
});

const removeGameFromCollection = async (gameId: string) => {
  try {
    await $fetch(`/api/v1/collection/${route.params.id}/entry`, {
      method: 'DELETE',
      body: { id: gameId }
    });
    
    // Refresh collection data after removal
    const updatedCollection = await $fetch<CollectionWithEntries>(`/api/v1/collection/${route.params.id}`, { headers });
    collection.value = updatedCollection;
  } catch (error) {
    console.error('Failed to remove game from collection:', error);
  }
};

useHead({
  title: collection.value?.name || 'Collection',
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
