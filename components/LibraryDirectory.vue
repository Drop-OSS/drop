<template>
  <div class="flex grow flex-col overflow-y-auto px-6 py-4">
    <span class="inline-flex items-center gap-x-2 font-semibold text-zinc-100">
      <Bars3Icon class="size-6" /> Library
    </span>

    <!-- Search bar -->
    <div class="mt-5 relative">
      <input
        id="search"
        v-model="searchQuery"
        type="text"
        name="search"
        autocomplete="off"
        class="block w-full rounded-md bg-zinc-900 py-2 pl-9 pr-2 text-sm text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600"
        placeholder="Search library..."
      />
      <MagnifyingGlassIcon
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
        aria-hidden="true"
      />
    </div>

    <TransitionGroup
      v-if="filteredLibrary.length > 0"
      name="list"
      tag="ul"
      role="list"
      class="mt-2 space-y-0.5"
    >
      <li v-for="game in filteredLibrary" :key="game.id" class="flex">
        <NuxtLink
          :to="`/library/game/${game.id}`"
          class="flex flex-row items-center w-full p-1 rounded-md transition-all duration-200 hover:bg-zinc-800 hover:scale-105 hover:shadow-lg active:scale-95"
        >
          <img
            :src="useObject(game.mCoverObjectId)"
            class="h-9 w-9 flex-shrink-0 rounded transition-all duration-300 group-hover:scale-105 hover:rotate-[-2deg] hover:shadow-lg"
            alt=""
          />
          <div class="min-w-0 flex-1 pl-2.5">
            <p
              class="text-sm font-semibold text-display text-zinc-200 truncate text-left"
            >
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
import { Bars3Icon, MagnifyingGlassIcon } from "@heroicons/vue/24/solid";

const library = await useLibrary();

const searchQuery = ref("");

const filteredLibrary = computed(() =>
  library.value.entries
    .map((e) => e.game)
    .filter((e) =>
      e.mName.toLowerCase().includes(searchQuery.value.toLowerCase()),
    ),
);
</script>
