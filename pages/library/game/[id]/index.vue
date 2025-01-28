<template>
  <div v-if="game">
    <!-- header -->
    <div class="relative">
      <!-- Banner image -->
      <div class="absolute top-0 inset-0 w-full rounded overflow-hidden">
        <img
          :src="useObject(game.mBannerId)"
          class="w-full h-full object-cover blur-sm"
        />
      </div>

      <!-- Content -->
      <div class="p-4 relative">
        <!-- Back button -->
        <div class="flex items-center gap-x-3 mb-4">
          <NuxtLink
            to="/library"
            class="px-2 py-1 rounded bg-zinc-900 transition text-sm/6 font-semibold text-zinc-400 hover:text-zinc-100 inline-flex gap-x-2 items-center"
          >
            <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
            Back to Collections
          </NuxtLink>
        </div>

        <div
          class="flex flex-col lg:flex-row items-center lg:items-start gap-6 w-full lg:w-fit bg-zinc-900 bg-backdrop-blur p-4 rounded-xl"
        >
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
            <div class="flex flex-col lg:flex-row mt-4 flex gap-3">
              <button
                type="button"
                class="inline-flex items-center justify-center gap-x-2 rounded-md bg-blue-600 px-3.5 py-2.5 text-base font-semibold font-display text-white shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-blue-500/25 hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Open in Launcher
                <ArrowTopRightOnSquareIcon
                  class="-mr-0.5 h-5 w-5"
                  aria-hidden="true"
                />
              </button>
              <AddLibraryButton class="font-bold" :gameId="game.id" />
              <NuxtLink
                :to="`/store/${game.id}`"
                class="inline-flex items-center justify-center gap-x-2 rounded-md bg-zinc-800 px-3.5 py-2.5 text-base font-semibold font-display text-white shadow-sm transition-all duration-200 hover:bg-zinc-700 hover:scale-105 hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
              >
                View in Store
                <ArrowUpRightIcon class="-mr-0.5 h-5 w-5" aria-hidden="true" />
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="min-h-[20vh]" />
  </div>
</template>

<script setup lang="ts">
import {
  ArrowTopRightOnSquareIcon,
  ArrowUpRightIcon,
  TrashIcon,
  ArrowLeftIcon,
  PlusIcon,
} from "@heroicons/vue/20/solid";
import { type Game, type GameVersion, type Collection } from "@prisma/client";

const route = useRoute();

const collections = await useCollections();
const library = await useLibrary();
const game = [...collections.value, library.value]
  .map((e) => e.entries.map((e) => e.game))
  .flat()
  .find((e) => e.id == route.params.id);

if (game === undefined)
  throw createError({
    statusCode: 404,
    statusMessage: JSON.stringify(collections.value),
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
