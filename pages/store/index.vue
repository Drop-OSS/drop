<!--
  This example requires some changes to your config:
  
  ```
  // tailwind.config.js
  module.exports = {
    // ...
    plugins: [
      // ...
      require('@tailwindcss/forms'),
    ],
  }
  ```
-->
<template>
  <div class="w-full flex flex-col">
    <!-- Hero section -->
    <VueCarousel
      v-if="recent.length > 0"
      :wrapAround="true"
      :items-to-show="1"
      :autoplay="15 * 1000"
      :transition="500"
      :pauseAutoplayOnHover="true"
    >
      <VueSlide v-for="game in recent" :key="game.id">
        <div class="w-full h-full relative overflow-hidden">
          <div class="absolute inset-0">
            <img
              :src="useObject(game.mBannerId)"
              alt=""
              class="size-full object-cover object-center"
            />
          </div>
          <div
            class="relative flex items-center justify-center w-full h-full bg-zinc-900/75 px-6 py-32 sm:px-12 sm:py-40 lg:px-16"
          >
            <div class="relative text-center">
              <h3 class="text-base/7 font-semibold text-blue-300">
                Recently added
              </h3>
              <h2
                class="text-3xl font-bold tracking-tight text-white sm:text-5xl"
              >
                {{ game.mName }}
              </h2>
              <p class="mt-3 text-lg text-zinc-300 line-clamp-2">
                {{ game.mShortDescription }}
              </p>
              <div class="mt-8 gap-x-4 inline-flex items-center">
                <NuxtLink
                  :href="`/store/${game.id}`"
                  class="block w-full rounded-md border border-transparent bg-white px-8 py-3 h-15 text-base font-medium text-gray-900 hover:bg-gray-100 sm:w-auto"
                  >Check it out</NuxtLink
                >
                <AddLibraryButton
                  :gameId="game.id"
                  :isProcessing="isAddingToLibrary[game.id]"
                  :isInLibrary="collectionStates[game.id]?.default"
                  :collections="collections"
                  :collectionStates="collectionStates[game.id] || {}"
                  @add-to-library="addToLibrary"
                  @toggle-collection="toggleCollection"
                  @create-collection="showCreateCollectionModal = true; selectedGame = game.id"
                />
              </div>
            </div>
          </div>
        </div>
      </VueSlide>

      <template #addons>
        <CarouselPagination class="py-2" :items="recent" />
      </template>
    </VueCarousel>
    <div
      v-else
      class="w-full h-full flex items-center justify-center bg-zinc-950/50 px-6 py-32 sm:px-12 sm:py-40 lg:px-16"
    >
      <h2
        class="uppercase text-xl font-bold tracking-tight text-zinc-700 sm:text-3xl"
      >
        no game
      </h2>
    </div>

    <!-- new releases -->
    <div class="px-4 sm:px-12 py-4">
      <h1 class="text-zinc-100 text-2xl font-bold font-display">
        Recently released
      </h1>
      <NuxtLink class="text-blue-600 font-semibold"
        >Explore more &rarr;</NuxtLink
      >
      <div class="mt-4">
        <GameCarousel :items="released" :min="12" />
      </div>
    </div>

    <!-- recently updated -->
    <div class="px-4 sm:px-12 py-4">
      <h1 class="text-zinc-100 text-2xl font-bold font-display">
        Recently updated
      </h1>
      <NuxtLink class="text-blue-600 font-semibold"
        >Explore more &rarr;</NuxtLink
      >
      <div class="mt-4">
        <GameCarousel :items="updated" :min="12" />
      </div>
    </div>

    <CreateCollectionModal
      :show="showCreateCollectionModal"
      :gameId="selectedGame"
      @close="showCreateCollectionModal = false"
      @created="handleCollectionCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { PlusIcon, ChevronDownIcon, CheckIcon } from "@heroicons/vue/24/solid";
import { ref, onMounted } from 'vue';
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/vue";
import { TransitionRoot, Dialog, DialogPanel, DialogTitle, TransitionChild } from "@headlessui/vue";
import AddLibraryButton from '../components/AddLibraryButton.vue';
import CreateCollectionModal from '../components/CreateCollectionModal.vue';

const headers = useRequestHeaders(["cookie"]);
const recent = await $fetch("/api/v1/store/recent", { headers });
const updated = await $fetch("/api/v1/store/updated", { headers });
const released = await $fetch("/api/v1/store/released", {
  headers,
});
const developers = await $fetch("/api/v1/store/developers", { headers });
const publishers = await $fetch("/api/v1/store/publishers", { headers });

const collections = ref<Collection[]>([]);
const collectionStates = ref<{ [gameId: string]: { [collectionId: string]: boolean } }>({});
const showCreateCollectionModal = ref(false);
const newCollectionName = ref('');
const isCreatingCollection = ref(false);
const selectedGame = ref<string | null>(null);
const isAddingToLibrary = ref<{ [key: string]: boolean }>({});

const addGameToCollection = async (gameId: string, collectionId: string) => {
  try {
    await $fetch(`/api/v1/collection/${collectionId}/entry`, {
      method: 'POST',
      body: { id: gameId }
    })
    
    // Update state
    if (!collectionStates.value[gameId]) {
      collectionStates.value[gameId] = {}
    }
    collectionStates.value[gameId][collectionId] = true
  } catch (error) {
    console.error('Failed to add game to collection:', error)
  }
}

const createCollection = async () => {
  if (!newCollectionName.value || isCreatingCollection.value) return
  
  try {
    isCreatingCollection.value = true
    
    // Create collection
    const response = await $fetch('/api/v1/collection', {
      method: 'POST',
      body: { name: newCollectionName.value }
    })
    
    // Add the game to the new collection
    await $fetch(`/api/v1/collection/${response.id}/entry`, {
      method: 'POST',
      body: { id: selectedGame.value }
    })
    
    // Refresh collections
    collections.value = await $fetch<Collection[]>('/api/v1/collection', { headers })
    
    // Set initial state for the new collection
    if (!collectionStates.value[selectedGame.value!]) {
      collectionStates.value[selectedGame.value!] = {}
    }
    collectionStates.value[selectedGame.value!][response.id] = true
    
    // Reset and close modal
    newCollectionName.value = ''
    showCreateCollectionModal.value = false
    selectedGame.value = null
  } catch (error) {
    console.error('Failed to create collection:', error)
  } finally {
    isCreatingCollection.value = false
  }
}

const addToLibrary = async (gameId: string) => {
  if (isAddingToLibrary.value[gameId]) return;
  
  try {
    isAddingToLibrary.value[gameId] = true;
    const defaultCollection = collections.value.find(c => c.isDefault);
    if (!defaultCollection) return;

    if (collectionStates.value[gameId]?.default) {
      // Remove from library
      await $fetch(`/api/v1/collection/${defaultCollection.id}/entry`, {
        method: "DELETE",
        body: { id: gameId }
      });
    } else {
      // Add to library
      await $fetch(`/api/v1/collection/default/entry`, {
        method: "POST",
        body: { id: gameId }
      });
    }
    // Toggle state
    if (!collectionStates.value[gameId]) {
      collectionStates.value[gameId] = {};
    }
    collectionStates.value[gameId].default = !collectionStates.value[gameId]?.default;
  } catch (error) {
    console.error("Failed to modify library:", error);
  } finally {
    isAddingToLibrary.value[gameId] = false;
  }
};

const toggleCollection = async (gameId: string, collectionId: string) => {
  try {
    if (!collectionStates.value[gameId]) {
      collectionStates.value[gameId] = {};
    }
    
    if (collectionStates.value[gameId][collectionId]) {
      // Remove from collection
      await $fetch(`/api/v1/collection/${collectionId}/entry`, {
        method: 'DELETE',
        body: { id: gameId }
      });
    } else {
      // Add to collection
      await $fetch(`/api/v1/collection/${collectionId}/entry`, {
        method: 'POST',
        body: { id: gameId }
      });
    }
    // Toggle state
    collectionStates.value[gameId][collectionId] = !collectionStates.value[gameId][collectionId];
  } catch (error) {
    console.error('Failed to toggle collection:', error);
  }
};

const handleCollectionCreated = async (collectionId: string) => {
  // Refresh collections
  collections.value = await $fetch<Collection[]>('/api/v1/collection', { headers });
  
  // Set initial state for the new collection
  if (selectedGame.value) {
    if (!collectionStates.value[selectedGame.value]) {
      collectionStates.value[selectedGame.value] = {};
    }
    collectionStates.value[selectedGame.value][collectionId] = true;
  }
  
  // Reset selected game
  selectedGame.value = null;
};

// Fetch collections on mount
onMounted(async () => {
  try {
    // Fetch collections with their entries
    collections.value = await $fetch<Collection[]>('/api/v1/collection', { headers });
    
    // Initialize collection states for each game
    for (const game of [...recent, ...updated, ...released]) {
      collectionStates.value[game.id] = {};
      for (const collection of collections.value) {
        const hasGame = collection.entries?.some(entry => entry.gameId === game.id);
        collectionStates.value[game.id][collection.id] = !!hasGame;
      }
    }
  } catch (error) {
    console.error('Failed to fetch collections:', error);
  }
});

useHead({
  title: "Store",
});
</script>
