<template>
  <div class="flex-1 overflow-y-auto px-4 py-5">
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
      class="space-y-1"
      v-if="filteredLibrary.length > 0"
    >
      <li v-for="game in filteredLibrary" :key="game.id" class="flex">
        <NuxtLink
          :to="`/library/game/${game.id}`"
          class="flex flex-row items-center w-full p-1.5 rounded-md transition-all duration-200 hover:bg-zinc-800 hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]"
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
        </NuxtLink>
      </li>
    </TransitionGroup>

    <p
      v-else
      class="text-zinc-600 text-sm font-display font-bold uppercase text-center mt-8"
    >
      {{ !!searchQuery ? "No results" : "No games in library" }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { MagnifyingGlassIcon } from "@heroicons/vue/24/solid";

const library = await useLibrary();

const searchQuery = ref("");

const filteredLibrary = computed(() =>
  library.value.entries
    .map((e) => e.game)
    .filter((e) =>
      e.mName.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
);
</script>
