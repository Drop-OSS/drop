<template>
  <div class="flex flex-row h-full">
    <!-- Left sidebar with game list -->
    <div class="w-64 min-w-64 border-r border-zinc-800 flex flex-col min-h-[75vh] h-full">
      <div class="flex-1 overflow-y-auto p-3">
        <h2 class="text-lg font-semibold tracking-tight text-zinc-100 mb-3">
          Your Library
        </h2>
        
        <!-- Search bar -->
        <div class="relative mb-3">
          <input
            type="text"
            name="search"
            id="search"
            autocomplete="off"
            class="block w-full rounded-md bg-zinc-900 py-1 pl-8 pr-2 text-sm text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600"
            placeholder="Search library..."
            v-model="searchQuery"
          />
          <MagnifyingGlassIcon
            class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
            aria-hidden="true"
          />
        </div>
        
        <TransitionGroup 
          name="list" 
          tag="ul" 
          role="list" 
          class="space-y-1 min-h-[calc(75vh-8rem)]"
        >
          <li v-for="game in filteredGames" :key="game.id" class="flex">
            <button 
              @click="selectedGame = game"
              class="flex flex-row items-center w-full p-1.5 rounded-md transition-all duration-200 hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98]"
              :class="{ 'bg-zinc-800': selectedGame?.id === game.id }"
            >
              <img 
                :src="useObject(game.mCoverId)"
                class="h-9 w-9 flex-shrink-0 rounded transition-all duration-300 group-hover:scale-105 hover:rotate-[-2deg] hover:shadow-lg"
                alt=""
              />
              <div class="min-w-0 flex-1 pl-2.5">
                <p class="text-xs font-medium text-zinc-100 truncate text-left">
                  {{ game.mName }}
                </p>
              </div>
            </button>
          </li>
        </TransitionGroup>

        <p
          v-if="games.length === 0"
          class="text-zinc-600 text-sm font-display font-bold uppercase text-center mt-8"
        >
          No games in library
        </p>
      </div>
    </div>

    <!-- Main content area -->
    <div class="flex-1 overflow-y-auto h-full no-scrollbar">
      <Transition name="fade" mode="out-in">
        <div v-if="selectedGame" class="relative h-full">
          <!-- Banner image -->
          <div class="absolute top-0 h-48 inset-x-0 -z-[20]">
            <img :src="useObject(selectedGame.mBannerId)" class="w-full h-48 object-cover blur-sm" />
            <div class="absolute inset-0 bg-gradient-to-b from-transparent to-80% to-zinc-950" />
          </div>

          <!-- Content -->
          <div class="relative pt-12 px-8 min-h-full">
            <!-- Only show back button when viewing game details -->
            <div v-if="selectedGame && !selectedCollection" class="flex items-center gap-x-3 mb-4">
              <button 
                @click="selectedGame = null"
                class="inline-flex items-center gap-x-2 rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white shadow-sm hover:bg-zinc-700 transition-all duration-200"
              >
                <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
                Back to Collections
              </button>
            </div>

            <div class="flex items-start gap-6">
              <img 
                :src="useObject(selectedGame.mCoverId)"
                class="w-32 h-auto rounded shadow-md transition-all duration-300 hover:scale-105 hover:rotate-[-2deg] hover:shadow-xl"
                alt=""
              />
              <div>
                <h1 class="text-3xl font-bold font-display text-zinc-100">
                  {{ selectedGame.mName }}
                </h1>
                <p class="mt-2 text-lg text-zinc-400">
                  {{ selectedGame.mShortDescription }}
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
                    @click="showAddToCollectionModal = true; gameToAddToCollection = selectedGame"
                    type="button"
                    class="inline-flex items-center gap-x-2 rounded-md bg-zinc-800 px-3.5 py-2.5 text-base font-semibold font-display text-white shadow-sm transition-all duration-200 hover:bg-zinc-700 hover:scale-105 hover:shadow-lg active:scale-95"
                  >
                    Add to Collection
                    <PlusIcon class="-mr-0.5 h-5 w-5" aria-hidden="true" />
                  </button>
                  <NuxtLink
                    :href="`/store/${selectedGame.id}`"
                    class="inline-flex items-center gap-x-2 rounded-md bg-zinc-800 px-3.5 py-2.5 text-base font-semibold font-display text-white shadow-sm transition-all duration-200 hover:bg-zinc-700 hover:scale-105 hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
                  >
                    View in Store
                    <ArrowUpRightIcon class="-mr-0.5 h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="selectedCollection" class="flex flex-col p-8">
          <div class="max-w-2xl">
            <div class="flex items-center gap-x-3 mb-4">
              <button 
                @click="selectedCollection = null"
                class="inline-flex items-center gap-x-2 rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white shadow-sm hover:bg-zinc-700 transition-all duration-200"
              >
                <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
                Back to Collections
              </button>
            </div>
            <h2 class="text-2xl font-bold font-display text-zinc-100">
              {{ selectedCollection.name }}
            </h2>
            <p class="mt-2 text-zinc-400">
              {{ selectedCollection.entries?.length || 0 }} games
            </p>
          </div>

          <!-- Games grid -->
          <div class="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            <button 
              v-for="game in selectedGames" 
              :key="game.id" 
              @click="selectedCollection = null; selectedGame = game"
              class="group relative h-32 rounded-lg overflow-hidden hover:scale-[1.02] transition-all duration-200"
            >
              <!-- Blurred banner background -->
              <div class="absolute inset-0 transition-all duration-300 group-hover:scale-110">
                <img 
                  :src="useObject(game.mBannerId)"
                  class="w-full h-full object-cover blur-[2px] brightness-[40%]"
                  alt=""
                />
                <div class="absolute inset-0 bg-gradient-to-r from-zinc-950/60 to-transparent" />
              </div>
              
              <!-- Game content -->
              <div class="relative h-full flex items-center p-6">
                <div>
                  <h3 class="text-xl font-bold font-display text-zinc-100">
                    {{ game.mName }}
                  </h3>
                  <p class="mt-2 text-sm text-zinc-300 line-clamp-2 max-w-xl">
                    {{ game.mShortDescription }}
                  </p>
                </div>
              </div>

              <!-- Delete button -->
              <button
                @click.stop="removeGameFromCollection(game.id, selectedCollection.id)"
                class="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-zinc-700/50 transition-all duration-200 text-zinc-400 hover:text-red-400"
              >
                <TrashIcon class="h-5 w-5" aria-hidden="true" />
              </button>
            </button>
          </div>
        </div>
        <div v-else class="flex flex-col p-8">
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
            <div v-for="collection in collections" :key="collection.id">
              <button 
                @click="handleCollectionClick(collection)"
                class="group relative rounded-lg bg-zinc-900/50 p-4 hover:bg-zinc-800/50 transition-all duration-200 text-left w-full"
                :class="{ 'bg-zinc-800/50': selectedCollection?.id === collection.id }"
              >
                <h3 class="text-lg font-semibold text-zinc-100">
                  {{ collection.name }}
                </h3>
                <p class="mt-1 text-sm text-zinc-400">
                  {{ collection._count?.entries || 0 }} games
                </p>
                
                <!-- Delete button (only show for non-default collections) -->
                <button
                  v-if="!collection.isDefault"
                  @click.stop="deleteCollection(collection)"
                  class="absolute top-1/2 -translate-y-1/2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-zinc-700/50 transition-all duration-200"
                >
                  <TrashIcon class="h-5 w-5 text-zinc-400 hover:text-red-400" />
                </button>
              </button>
            </div>

            <!-- Create new collection button (also wrap in div) -->
            <div>
              <button 
                @click="createNewCollection"
                class="group relative rounded-lg border-2 border-dashed border-zinc-800 p-4 hover:border-zinc-700 hover:bg-zinc-900/30 transition-all duration-200 text-left w-full"
              >
                <div class="flex items-center gap-3">
                  <PlusIcon class="h-5 w-5 text-zinc-400 group-hover:text-zinc-300" />
                  <h3 class="text-lg font-semibold text-zinc-400 group-hover:text-zinc-300">
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
      </Transition>
    </div>
  </div>

  <!-- Add a modal for creating new collections -->
  <TransitionRoot appear :show="showCreateModal" as="template">
    <Dialog as="div" @close="showCreateModal = false" class="relative z-50">
      <div class="fixed inset-0 bg-black/30 transition-opacity duration-300"
           :class="{
             'opacity-0': !showCreateModal,
             'opacity-100': showCreateModal
           }"
      />

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-md rounded-lg bg-zinc-900 p-6">
              <DialogTitle class="text-lg font-semibold text-zinc-100">
                Create New Collection
              </DialogTitle>
              <div class="mt-4">
                <input
                  type="text"
                  v-model="newCollectionName"
                  placeholder="Collection name"
                  class="w-full rounded-md bg-zinc-800 px-3 py-2 text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500"
                  @keyup.enter="handleCreateCollection"
                />
              </div>
              <div class="mt-6 flex justify-end gap-3">
                <button
                  @click="showCreateModal = false"
                  class="rounded-md px-3 py-2 text-sm text-zinc-400 hover:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  @click="handleCreateCollection"
                  class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
                  :disabled="!newCollectionName"
                >
                  Create
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>

  <!-- Add a modal for deleting collections -->
  <TransitionRoot appear :show="showDeleteModal" as="template">
    <Dialog as="div" @close="showDeleteModal = false" class="relative z-50">
      <div class="fixed inset-0 bg-black/30 transition-opacity duration-300"
           :class="{
             'opacity-0': !showDeleteModal,
             'opacity-100': showDeleteModal
           }"
      />

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-md rounded-lg bg-zinc-900 p-6">
              <DialogTitle class="text-lg font-semibold text-zinc-100">
                Delete Collection
              </DialogTitle>
              <div class="mt-4">
                <p class="text-zinc-400">
                  Are you sure you want to delete "{{ collectionToDelete?.name }}"? This action cannot be undone.
                </p>
              </div>
              <div class="mt-6 flex justify-end gap-3">
                <button
                  @click="showDeleteModal = false"
                  class="rounded-md px-3 py-2 text-sm text-zinc-400 hover:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  @click="handleDeleteCollection"
                  class="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500"
                >
                  Delete
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>

  <!-- Add this modal at the bottom of the template -->
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
                    v-for="collection in collections.filter(c => !c.isDefault)"
                    :key="collection.id"
                    @click="addGameToCollection(gameToAddToCollection?.id!, collection.id)"
                    class="w-full text-left px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors duration-200 text-zinc-100"
                  >
                    {{ collection.name }}
                    <span class="text-sm text-zinc-500 ml-2">
                      {{ collection._count?.entries || 0 }} games
                    </span>
                  </button>
                </div>
                
                <p v-if="collections.filter(c => !c.isDefault).length === 0" class="text-center text-zinc-500 py-4">
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
import { ArrowTopRightOnSquareIcon, ArrowUpRightIcon, TrashIcon, ArrowLeftIcon } from "@heroicons/vue/20/solid";
import { MagnifyingGlassIcon } from "@heroicons/vue/24/outline";
import { type Game, type GameVersion, type Collection } from "@prisma/client";
import { ref as vueRef } from 'vue';
import { PlusIcon } from "@heroicons/vue/20/solid";
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";

const headers = useRequestHeaders(["cookie"]);
const { data: gamesData } = await useFetch<(Game & { versions: GameVersion[] })[]>("/api/v1/store/recent", { headers });
const games = ref(gamesData.value || []);

const selectedGame = ref<(Game & { versions: GameVersion[] }) | null>(null);
const searchQuery = ref("");
const collections = ref<Collection[]>([]);
const showCreateModal = ref(false);
const newCollectionName = ref("");
const showDeleteModal = ref(false);
const collectionToDelete = ref<Collection | null>(null);
const selectedCollection = ref<Collection | null>(null);
const showAddToCollectionModal = ref(false);
const gameToAddToCollection = ref<Game | null>(null);

const filteredGames = computed(() => {
  if (!searchQuery.value) return games.value;
  const query = searchQuery.value.toLowerCase();
  return games.value.filter(game => 
    game.mName.toLowerCase().includes(query)
  );
});

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
  title: "Library",
});

const handleCreateCollection = async () => {
  if (!newCollectionName.value) return;
  
  try {
    const newCollection = await $fetch<Collection>("/api/v1/collection", {
      method: "POST",
      body: { name: newCollectionName.value },
    });
    collections.value.push(newCollection);
    showCreateModal.value = false;
    newCollectionName.value = "";
  } catch (error) {
    console.error("Failed to create collection:", error);
  }
};

const deleteCollection = async (collection: Collection) => {
  collectionToDelete.value = collection;
  showDeleteModal.value = true;
};

const handleDeleteCollection = async () => {
  if (!collectionToDelete.value) return;
  
  try {
    await $fetch(`/api/v1/collection/${collectionToDelete.value.id}`, { method: "DELETE" });
    collections.value = collections.value.filter(c => c.id !== collectionToDelete.value?.id);
    showDeleteModal.value = false;
    collectionToDelete.value = null;
  } catch (error) {
    console.error("Failed to delete collection:", error);
  }
};

const createNewCollection = () => {
  showCreateModal.value = true;
};

const handleCollectionClick = async (collection: Collection) => {
  try {
    const fullCollection = await $fetch<Collection>(`/api/v1/collection/${collection.id}`);
    selectedCollection.value = fullCollection;
    selectedGame.value = null;
  } catch (error) {
    console.error("Failed to fetch collection details:", error);
  }
};

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
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}
</style> 
