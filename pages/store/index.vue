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
                  class="block w-full rounded-md border border-transparent bg-white px-8 py-3 text-base font-medium text-gray-900 hover:bg-gray-100 sm:w-auto"
                  >Check it out</NuxtLink
                >
                <button
                  type="button"
                  class="inline-flex items-center gap-x-2 rounded-md px-3.5 py-2.5 text-base font-semibold font-display text-white shadow-sm hover:bg-zinc-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100"
                >
                  Add to Library
                  <PlusIcon class="-mr-0.5 h-7 w-7" aria-hidden="true" />
                </button>
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

    <!-- Search bar -->
    <div class="px-4 sm:px-12 py-4">
      <div class="flex gap-x-4">
        <!-- Search input -->
        <div class="grow relative">
          <input
            type="text"
            name="search"
            id="search"
            autocomplete="off"
            class="col-start-1 row-start-1 block w-full rounded-md bg-zinc-900 py-1.5 pl-10 pr-3 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:pl-9 sm:text-sm/6"
            placeholder="Search library..."
            v-model="searchQuery"
          />
          <MagnifyingGlassIcon
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-6 w-6 text-zinc-400"
            aria-hidden="true"
          />
        </div>

        <!-- Sort options - only show when there are search results -->
        <div v-if="searchQuery && filteredGames.length > 0" class="relative">
          <select
            v-model="sortOption"
            class="rounded-md bg-zinc-900 py-2 pl-3 pr-10 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
          >
            <option value="recent">Recently Added</option>
            <option value="updated">Recently Updated</option>
            <option value="name">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </select>
          <ChevronUpDownIcon
            class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>

    <!-- Conditional rendering of regular content vs search results -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-in"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="!searchQuery">
        <!-- new releases -->
        <div class="px-4 sm:px-12 py-4">
          <h1 class="text-zinc-100 text-2xl font-bold font-display">
            Recently released
          </h1>
          <NuxtLink class="text-blue-600 font-semibold"
            >Explore more &rarr;</NuxtLink
          >
          <div class="mt-4">
            <GameCarousel :items="sortedReleased" :min="12" />
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
            <GameCarousel :items="sortedUpdated" :min="12" />
          </div>
        </div>
      </div>
    </Transition>

    <!-- Add transition to search results -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-in"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="searchQuery" class="px-4 sm:px-12 py-4">
        <h1 class="text-zinc-100 text-2xl font-bold font-display">
          Search Results
        </h1>
        <div v-if="filteredGames.length === 0" class="mt-8 text-center">
          <div class="inline-flex items-center justify-center size-12 rounded-full bg-zinc-800 mb-4">
            <QuestionMarkCircleIcon class="size-6 text-zinc-400" aria-hidden="true" />
          </div>
          <p class="text-zinc-500">
            No games found matching "{{ searchQuery }}"
          </p>
        </div>
        <div v-else class="mt-4">
          <GameCarousel :items="filteredGames" :min="12" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { PlusIcon } from "@heroicons/vue/24/solid";
import { QuestionMarkCircleIcon } from "@heroicons/vue/24/outline";
import { ChevronUpDownIcon } from "@heroicons/vue/20/solid";

const headers = useRequestHeaders(["cookie"]);
const recent = await $fetch("/api/v1/store/recent", { headers });
const updated = await $fetch("/api/v1/store/updated", { headers });
const released = await $fetch("/api/v1/store/released", { headers });
const developers = await $fetch("/api/v1/store/developers", { headers });
const publishers = await $fetch("/api/v1/store/publishers", { headers });

// Add search functionality
const searchQuery = ref("");
const allGames = [...recent, ...updated, ...released].filter((game, index, self) => 
  index === self.findIndex((g) => g.id === game.id)
);

const sortOption = ref('recent');

const sortGames = (games: any[]) => {
  switch (sortOption.value) {
    case 'name':
      return [...games].sort((a, b) => a.mName.localeCompare(b.mName));
    case 'name-desc':
      return [...games].sort((a, b) => b.mName.localeCompare(a.mName));
    case 'recent':
      return [...games].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'updated':
      return [...games].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    default:
      return games;
  }
};

const filteredGames = computed(() => {
  if (!searchQuery.value) return [];
  const query = searchQuery.value.toLowerCase();
  const filtered = allGames.filter(game => 
    game.mName.toLowerCase().includes(query) || 
    game.mShortDescription.toLowerCase().includes(query)
  );
  return sortGames(filtered);
});

// Also sort the regular sections when not searching
const sortedReleased = computed(() => sortGames(released));
const sortedUpdated = computed(() => sortGames(updated));

useHead({
  title: "Store",
});
</script>
