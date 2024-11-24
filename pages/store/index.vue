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
            class="relative w-full h-full bg-zinc-900/75 px-6 py-32 sm:px-12 sm:py-40 lg:px-16"
          >
            <div
              class="relative mx-auto flex max-w-xl flex-col items-center text-center"
            >
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
              <NuxtLink
                :href="`/store/${game.id}`"
                class="mt-8 block w-full rounded-md border border-transparent bg-white px-8 py-3 text-base font-medium text-gray-900 hover:bg-gray-100 sm:w-auto"
                >Check it out</NuxtLink
              >
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
const headers = useRequestHeaders(["cookie"]);
const recent = await $fetch("/api/v1/store/recent", { headers });
const updated = await $fetch("/api/v1/store/updated", { headers });
const released = await $fetch("/api/v1/store/released", {
  headers,
});

useHead({
  title: "Store",
});
</script>
