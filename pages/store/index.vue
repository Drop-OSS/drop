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
  </div>
</template>

<script setup lang="ts">
import { PlusIcon } from "@heroicons/vue/24/solid";

const headers = useRequestHeaders(["cookie"]);
const recent = await $fetch("/api/v1/store/recent", { headers });
const updated = await $fetch("/api/v1/store/updated", { headers });
const released = await $fetch("/api/v1/store/released", {
  headers,
});
const developers = await $fetch("/api/v1/store/developers", { headers });
const publishers = await $fetch("/api/v1/store/publishers", { headers });

useHead({
  title: "Store",
});
</script>
