<template>
  <div
    class="mx-auto w-full relative flex flex-col justify-center pt-72 overflow-hidden"
  >
    <!-- Banner background with gradient overlays -->
    <div class="absolute inset-0 z-0 rounded-xl overflow-hidden">
      <img
        :src="useObject(game.mBannerId)"
        class="w-full h-[24rem] object-cover blur-sm scale-105"
      >
      <div
        class="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent opacity-90"
      />
      <div
        class="absolute inset-0 bg-gradient-to-r from-zinc-900/95 via-zinc-900/80 to-transparent opacity-90"
      />
    </div>

    <div class="relative z-10">
      <div class="px-4 sm:px-8pb-4">
        <div class="flex items-center gap-x-3 mb-4">
          <NuxtLink
            to="/library"
            class="transition text-sm/6 font-semibold text-zinc-400 hover:text-zinc-100 inline-flex gap-x-2 items-center duration-200 hover:scale-105"
          >
            <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
            Back to Library
          </NuxtLink>
        </div>

        <!-- Game title and description -->
        <h1
          class="text-3xl sm:text-5xl text-zinc-100 font-bold font-display drop-shadow-lg"
        >
          {{ game.mName }}
        </h1>
        <p class="mt-4 mb-8 text-sm sm:text-lg text-zinc-400 max-w-3xl">
          {{ game.mShortDescription }}
        </p>

        <div class="flex items-stretch flex-col lg:flex-row gap-3">
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
          <div class="relative z-50">
            <AddLibraryButton class="font-bold" :game-id="game.id" />
          </div>
          <NuxtLink
            :to="`/store/${game.id}`"
            class="inline-flex items-center justify-center gap-x-2 rounded-md bg-zinc-800 px-3.5 py-2.5 text-base font-semibold font-display text-white shadow-sm transition-all duration-200 hover:bg-zinc-700 hover:scale-105 hover:shadow-lg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
          >
            View in Store
            <ArrowUpRightIcon class="-mr-0.5 h-5 w-5" aria-hidden="true" />
          </NuxtLink>
        </div>
      </div>

      <!-- Main content -->
      <div class="w-full bg-zinc-900 px-4 sm:px-8 py-3 sm:py-6">
        <div class="mt-8 flex flex-col gap-5 sm:gap-10">
          <div class="col-start-1 lg:col-start-2 space-y-6">
            <div class="bg-zinc-800/50 rounded-xl p-6 backdrop-blur-sm">
              <h2 class="text-xl font-display font-semibold text-zinc-100 mb-4">
                Game Images
              </h2>
              <div class="relative">
                <VueCarousel :items-to-show="1">
                  <VueSlide v-for="image in game.mImageCarousel" :key="image">
                    <img
                      class="w-fit h-48 lg:h-96 rounded"
                      :src="useObject(image)"
                    >
                  </VueSlide>
                  <VueSlide v-if="game.mImageCarousel.length == 0">
                    <div
                      class="h-48 lg:h-96 aspect-[1/2] flex items-center justify-center text-zinc-700 font-bold font-display"
                    >
                      No images
                    </div>
                  </VueSlide>

                  <template #addons>
                    <VueNavigation />
                    <CarouselPagination class="py-2 px-12" />
                  </template>
                </VueCarousel>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="bg-zinc-800/50 rounded-xl p-6 backdrop-blur-sm">
              <div
                class="prose prose-invert prose-blue overflow-y-auto custom-scrollbar max-w-none"
                v-html="descriptionHTML"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhotoIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpRightIcon,
} from "@heroicons/vue/20/solid";
import { BuildingStorefrontIcon } from "@heroicons/vue/24/outline";
import { micromark } from "micromark";
import type { Game } from "@prisma/client";

const route = useRoute();
const id = route.params.id.toString();

const rawGame = await $dropFetch<Game>(`/api/v1/games/${id}`);
const game = computed(() => {
  if (!rawGame) {
    throw createError({ statusCode: 404, message: "Game not found" });
  }
  return rawGame;
});

// Convert markdown to HTML
const descriptionHTML = computed(() =>
  micromark(game.value.mDescription ?? "")
);

const currentImageIndex = ref(0);

function nextImage() {
  if (!game.value?.mImageCarousel) return;
  currentImageIndex.value =
    (currentImageIndex.value + 1) % game.value.mImageCarousel.length;
}

function previousImage() {
  if (!game.value?.mImageCarousel) return;
  currentImageIndex.value =
    (currentImageIndex.value - 1 + game.value.mImageCarousel.length) %
    game.value.mImageCarousel.length;
}
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  position: absolute;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-100%);
}

.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgb(82 82 91) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgb(82 82 91);
  border-radius: 3px;
}

:deep(.relative) {
  z-index: 10;
}

:deep(.dropdown-content) {
  z-index: 20;
}
</style>
