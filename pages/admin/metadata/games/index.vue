<template>
  <div class="space-y-4">
    <div class="mx-auto max-w-2xl lg:mx-0">
      <h2
        class="mt-2 text-xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
      >
        Metadata Library
      </h2>
      <p
        class="mt-2 text-pretty text-sm font-medium text-gray-500 sm:text-md/8"
      >
        <span class="text-zinc-100 font-bold"
          >To import or delete games, visit the Library tab.</span
        >
        Here, you can edit and update your game's metadata.
      </p>
    </div>
    <div class="mt-2 grid grid-cols-1">
      <input
        id="search"
        v-model="searchQuery"
        type="text"
        name="search"
        class="col-start-1 row-start-1 block w-full rounded-md bg-zinc-900 py-1.5 pl-10 pr-3 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:pl-9 sm:text-sm/6"
        placeholder="Search library..."
      />
      <MagnifyingGlassIcon
        class="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-zinc-400 sm:size-4"
        aria-hidden="true"
      />
    </div>
    <ul
      role="list"
      class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
    >
      <li
        v-for="game in filteredLibraryGames"
        :key="game.id"
        class="col-span-1 flex flex-col justify-center divide-y divide-zinc-700 rounded-lg bg-zinc-950/20 text-left shadow"
      >
        <div class="flex flex-1 flex-row p-4 gap-x-4">
          <img
            class="h-16 w-16 flex-shrink-0 rounded-md"
            :src="useObject(game.mIconObjectId)"
            alt=""
          />
          <div class="flex flex-col">
            <h3 class="text-sm font-medium text-zinc-100 font-display">
              {{ game.mName }}
              <span
                class="ml-2 inline-flex items-center rounded-full bg-blue-600/10 px-2 py-1 text-xs font-medium text-blue-600 ring-1 ring-inset ring-blue-600/20"
                >{{ game.metadataSource }}</span
              >
            </h3>
            <dl class="mt-1 flex flex-col justify-between">
              <dt class="sr-only">Short Description</dt>
              <dd class="text-sm text-zinc-400">
                {{ game.mShortDescription }}
              </dd>
              <dt class="sr-only">Metadata provider</dt>
            </dl>
            <div class="mt-4 flex flex-col gap-y-1">
              <NuxtLink
                :href="`/admin/metadata/games/${game.id}`"
                class="w-fit rounded-md bg-blue-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Open with Metadata &rarr;
              </NuxtLink>
              <NuxtLink
                :href="`/admin/library/${game.id}`"
                class="w-fit rounded-md bg-zinc-800 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Open with Library &rarr;
              </NuxtLink>
            </div>
          </div>
        </div>
      </li>
      <p
        v-if="filteredLibraryGames.length == 0 && libraryGames.length != 0"
        class="text-zinc-600 text-sm font-display font-bold uppercase text-center col-span-4"
      >
        No results
      </p>
      <p
        v-if="filteredLibraryGames.length == 0 && libraryGames.length == 0"
        class="text-zinc-600 text-sm font-display font-bold uppercase text-center col-span-4"
      >
        No games imported
      </p>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { MagnifyingGlassIcon } from "@heroicons/vue/24/outline";
definePageMeta({
  layout: "admin",
});

useHead({
  title: "Game Library | Metadata",
});

const searchQuery = ref("");

const libraryState = await $dropFetch("/api/v1/admin/library");
const libraryGames = ref(libraryState.games.map((e) => e.game));

const filteredLibraryGames = computed(() =>
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore excessively deep ts
  libraryGames.value.filter((e) => {
    if (!searchQuery.value) return true;
    const searchQueryLower = searchQuery.value.toLowerCase();
    if (e.mName.toLowerCase().includes(searchQueryLower)) return true;
    if (e.mShortDescription.toLowerCase().includes(searchQueryLower))
      return true;
    return false;
  }),
);
</script>
