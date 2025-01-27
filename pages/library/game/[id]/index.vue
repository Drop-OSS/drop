<template>
  <div class="flex flex-row h-full">
    <!-- Main content area -->
    <div class="flex-1 overflow-y-auto h-full no-scrollbar">
      <Transition name="fade" mode="out-in">
        <div v-if="game" class="relative h-full">
          <!-- Banner image -->
          <div class="absolute top-0 h-48 inset-x-0 -z-[20]">
            <img :src="useObject(game.mBannerId)" class="w-full h-48 object-cover blur-sm" />
            <div class="absolute inset-0 bg-gradient-to-b from-transparent to-80% to-zinc-950" />
          </div>

          <!-- Content -->
          <div class="relative pt-12 px-8 min-h-full">
            <!-- Back button -->
            <div class="flex items-center gap-x-3 mb-4">
              <NuxtLink 
                to="/library"
                class="inline-flex items-center gap-x-2 rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white shadow-sm hover:bg-zinc-700 transition-all duration-200"
              >
                <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
                Back to Collections
              </NuxtLink>
            </div>

            <div class="flex items-start gap-6">
              <img 
                :src="useObject(game.mCoverId)"
                class="w-32 h-auto rounded shadow-md transition-all duration-300 hover:scale-105 hover:rotate-[-2deg] hover:shadow-xl"
                alt=""
              />
              <div>
                <h1 class="text-3xl font-bold font-display text-zinc-100">
                  {{ game.mName }}
                </h1>
                <p class="mt-2 text-lg text-zinc-400">
                  {{ game.mShortDescription }}
                </p>
                <!-- Buttons -->
                <div class="mt-4 flex gap-x-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-x-2 rounded-md bg-blue-600 px-3.5 py-2.5 text-base font-semibold font-display text-white shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-blue-500/25 hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Open in Launcher
                    <ArrowTopRightOnSquareIcon class="-mr-0.5 h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    @click="showAddToCollectionModal = true; gameToAddToCollection = game"
                    type="button"
                    class="inline-flex items-center gap-x-2 rounded-md bg-zinc-800 px-3.5 py-2.5 text-base font-semibold font-display text-white shadow-sm transition-all duration-200 hover:bg-zinc-700 hover:scale-105 hover:shadow-lg active:scale-95"
                  >
                    Add to Collection
                    <PlusIcon class="-mr-0.5 h-5 w-5" aria-hidden="true" />
                  </button>
                  <NuxtLink
                    :to="`/store/${game.id}`"
                    class="inline-flex items-center gap-x-2 rounded-md bg-zinc-800 px-3.5 py-2.5 text-base font-semibold font-display text-white shadow-sm transition-all duration-200 hover:bg-zinc-700 hover:scale-105 hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
                  >
                    View in Store
                    <ArrowUpRightIcon class="-mr-0.5 h-5 w-5" aria-hidden="true" />
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>

  <!-- Add to Collection Modal -->
  <TransitionRoot appear :show="showAddToCollectionModal" as="template">
    <Dialog as="div" @close="showAddToCollectionModal = false" class="relative z-50">
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-zinc-950/80" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 text-center">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-xl bg-zinc-900 p-6 text-left align-middle shadow-xl transition-all">
              <DialogTitle as="h3" class="text-lg font-bold font-display text-zinc-100">
                Add to Collection
              </DialogTitle>
              <div class="mt-4">
                <div class="space-y-2">
                  <button
                    v-for="collection in collections"
                    :key="collection.id"
                    @click="addGameToCollection(game?.id!, collection.id)"
                    class="w-full text-left px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors duration-200 text-zinc-100"
                  >
                    {{ collection.name }}
                    <span class="text-sm text-zinc-500 ml-2">
                      {{ collection._count?.entries || 0 }} games
                    </span>
                  </button>
                </div>
                
                <p v-if="collections.length === 0" class="text-center text-zinc-500 py-4">
                  No collections available. Create one first!
                </p>
              </div>

              <div class="mt-6 flex justify-end">
                <button
                  type="button"
                  @click="showAddToCollectionModal = false"
                  class="inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 focus:outline-none"
                >
                  Close
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
  
<script setup lang="ts">
import { ArrowTopRightOnSquareIcon, ArrowUpRightIcon, TrashIcon, ArrowLeftIcon, PlusIcon } from "@heroicons/vue/20/solid";
import { type Game, type GameVersion, type Collection } from "@prisma/client";
import { ref as vueRef } from 'vue';
import { PlusIcon as PlusIconSolid } from "@heroicons/vue/20/solid";
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";

const route = useRoute();
const headers = useRequestHeaders(["cookie"]);
const { data: gamesData } = await useFetch<(Game & { versions: GameVersion[] })[]>("/api/v1/store/recent", { headers });
const games = ref(gamesData.value || []);

const selectedGame = ref<(Game & { versions: GameVersion[] }) | null>(null);
const collections = ref<Collection[]>([]);
const showCreateModal = ref(false);
const newCollectionName = ref("");
const showDeleteModal = ref(false);
const collectionToDelete = ref<Collection | null>(null);
const selectedCollection = ref<Collection | null>(null);
const showAddToCollectionModal = ref(false);
const gameToAddToCollection = ref<Game | null>(null);

  // Fetch game data based on route parameter
  const { data: game } = await useFetch<Game & { versions: GameVersion[] }>(
  `/api/v1/games/${route.params.id}`,
  { headers }
);

const selectedGames = computed(() => {
  if (!selectedCollection.value?.entries) return [];
  return selectedCollection.value.entries.map(entry => entry.game);
});

// Fetch collections when component mounts
onMounted(async () => {
  try {
    const fetchedCollections = await $fetch<Collection[]>("/api/v1/collection", { headers });
    // Sort collections to put default library first
    collections.value = fetchedCollections.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return 0;
    });
  } catch (error) {
    console.error("Failed to fetch collections:", error);
  }
});

useHead({
  title: game.value?.mName,
});


const removeGameFromCollection = async (gameId: string, collectionId: string) => {
  try {
    await $fetch(`/api/v1/collection/${collectionId}/entry`, {
      method: 'DELETE',
      body: { id: gameId }
    });
    
    // Update the collection's entries after removal
    const updatedCollection = await $fetch<Collection>(`/api/v1/collection/${collectionId}`, { headers });
    selectedCollection.value = updatedCollection;

    // Refresh the collections list to update the game count
    const fetchedCollections = await $fetch<Collection[]>("/api/v1/collection", { headers });
    collections.value = fetchedCollections.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return 0;
    });
  } catch (error) {
    console.error('Failed to remove game from collection:', error);
  }
};

const addGameToCollection = async (gameId: string, collectionId: string) => {
  try {
    await $fetch(`/api/v1/collection/${collectionId}/entry`, {
      method: 'POST',
      body: { id: gameId }
    });
    
    // Refresh collections after adding
    const fetchedCollections = await $fetch<Collection[]>("/api/v1/collection", { headers });
    collections.value = fetchedCollections.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return 0;
    });
    showAddToCollectionModal.value = false;
  } catch (error) {
    console.error('Failed to add game to collection:', error);
  }
};
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
/* Hide scrollbar for Chrome, Safari and Opera */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}
</style>
