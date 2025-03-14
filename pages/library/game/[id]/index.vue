<template>
  <div
    class="mx-auto w-full relative flex flex-col justify-center pt-72 overflow-hidden"
  >
    <!-- Banner background with gradient overlays -->
    <div class="absolute inset-0 z-0">
      <img
        :src="useObject(game.mBannerId)"
        class="w-full h-[24rem] object-cover blur-sm scale-105"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/80 to-transparent opacity-90"
      />
      <div
        class="absolute inset-0 bg-gradient-to-r from-zinc-900/95 via-zinc-900/80 to-transparent opacity-90"
      />
    </div>

    <div class="relative z-10">
      <div class="px-8 pb-4">
        <div class="flex items-center gap-x-3 mb-4">
          <NuxtLink
            to="/library"
            class="transition text-sm/6 font-semibold text-zinc-400 hover:text-zinc-100 inline-flex gap-x-2 items-center duration-200 hover:scale-105"
          >
            <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
            Back to Collections
          </NuxtLink>
        </div>

        <!-- Game title and description -->
        <h1
          class="text-5xl text-zinc-100 font-bold font-display drop-shadow-lg"
        >
          {{ game.mName }}
        </h1>
        <p class="mt-4 mb-8 text-lg text-zinc-400 max-w-3xl">
          {{ game.mShortDescription }}
        </p>

        <div class="flex flex-col lg:flex-row gap-3">
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
            <AddLibraryButton class="font-bold" :gameId="game.id" />
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
      <div class="w-full bg-zinc-900 px-8 py-6">
        <div class="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-10">
          <div class="lg:col-span-3 space-y-6">
            <div class="bg-zinc-800/50 rounded-xl p-6 backdrop-blur-sm">
              <div
                v-html="descriptionHTML"
                class="prose prose-invert prose-blue overflow-y-auto custom-scrollbar max-w-none"
              ></div>
            </div>
          </div>

          <div class="col-start-1 lg:col-start-4 space-y-6">
            <div class="bg-zinc-800/50 rounded-xl p-6 backdrop-blur-sm">
              <h2 class="text-xl font-display font-semibold text-zinc-100 mb-4">
                Game Images
              </h2>
              <div class="relative">
                <div v-if="game.mImageCarousel.length > 0">
                  <div
                    class="relative aspect-video rounded-lg overflow-hidden cursor-pointer group"
                  >
                    <div class="absolute inset-0">
                      <TransitionGroup name="slide" tag="div" class="h-full">
                        <img
                          v-for="(imageId, index) in game.mImageCarousel"
                          :key="imageId"
                          :src="useObject(imageId)"
                          class="absolute inset-0 w-full h-full object-cover"
                          v-show="index === currentImageIndex"
                        />
                      </TransitionGroup>
                    </div>

                    <div
                      class="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <button
                        v-if="game.mImageCarousel.length > 1"
                        @click.stop="previousImage()"
                        class="p-2 rounded-full bg-zinc-900/50 text-zinc-100 hover:bg-zinc-900/80 transition-all duration-300 hover:scale-110"
                      >
                        <ChevronLeftIcon class="size-5" />
                      </button>
                      <button
                        v-if="game.mImageCarousel.length > 1"
                        @click.stop="nextImage()"
                        class="p-2 rounded-full bg-zinc-900/50 text-zinc-100 hover:bg-zinc-900/80 transition-all duration-300 hover:scale-110"
                      >
                        <ChevronRightIcon class="size-5" />
                      </button>
                    </div>
                  </div>

                  <div
                    class="flex justify-center gap-x-2 mt-4"
                  >
                    <button
                      v-for="(_, index) in game.mImageCarousel"
                      :key="index"
                      @click.stop="currentImageIndex = index"
                      class="w-2 h-2 rounded-full transition-all duration-300"
                      :class="[
                        currentImageIndex === index
                          ? 'bg-zinc-100 scale-125'
                          : 'bg-zinc-600 hover:bg-zinc-500',
                      ]"
                    />
                  </div>
                </div>

                <!-- No images placeholder -->
                <div
                  v-else
                  class="aspect-video rounded-lg overflow-hidden bg-zinc-900/50 flex flex-col items-center justify-center text-center px-4"
                >
                  <PhotoIcon class="size-12 text-zinc-500 mb-2" />
                  <p class="text-zinc-400 font-medium">No images available</p>
                  <p class="text-zinc-500 text-sm">
                    Game screenshots will appear here when available
                  </p>
                </div>
              </div>
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
  ArrowUpRightIcon 
} from "@heroicons/vue/20/solid";
import { BuildingStorefrontIcon } from "@heroicons/vue/24/outline";
import { micromark } from "micromark";
import type { Game } from "@prisma/client";

const route = useRoute();
const id = route.params.id.toString();

const { data: rawGame } = await useFetch<Game>(`/api/v1/games/${id}`);
const game = computed(() => {
  if (!rawGame.value) {
    throw createError({ statusCode: 404, message: 'Game not found' });
  }
  return rawGame.value;
});

// Convert markdown to HTML
const descriptionHTML = computed(() => micromark(game.value.mDescription ?? ""));

const currentImageIndex = ref(0);

function nextImage() {
  if (!game.value?.mImageCarousel) return;
  currentImageIndex.value = (currentImageIndex.value + 1) % game.value.mImageCarousel.length;
}

function previousImage() {
  if (!game.value?.mImageCarousel) return;
  currentImageIndex.value = (currentImageIndex.value - 1 + game.value.mImageCarousel.length) % game.value.mImageCarousel.length;
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
