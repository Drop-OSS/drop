<template>
  <div class="w-full flex flex-col overflow-x-hidden">
    <!-- Hero section -->
    <VueCarousel
      v-if="recent.length > 0"
      :wrap-around="true"
      :items-to-show="1"
      :autoplay="15 * 1000"
      :transition="500"
      :pause-autoplay-on-hover="true"
      class="store-carousel"
    >
      <VueSlide v-for="game in recent" :key="game.id">
        <div class="w-full h-full relative">
          <div class="absolute inset-0">
            <img
              :src="useObject(game.mBannerObjectId)"
              alt=""
              class="size-full object-cover object-center"
            />
          </div>
          <div
            class="relative flex items-center justify-center w-full h-full bg-zinc-900/75 px-6 py-32 sm:px-12 sm:py-40 lg:px-16"
          >
            <div class="relative text-center">
              <h3 class="text-base/7 font-semibold text-blue-300">
                {{ $t("store.featured") }}
              </h3>
              <h2
                class="text-3xl font-bold tracking-tight text-white sm:text-5xl"
              >
                {{ game.mName }}
              </h2>
              <p
                class="mt-3 text-lg text-zinc-300 line-clamp-2 max-w-xl mx-auto"
              >
                {{ game.mShortDescription }}
              </p>
              <div>
                <div
                  class="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 w-fit mx-auto"
                >
                  <NuxtLink
                    :href="`/store/${game.id}`"
                    class="block w-full rounded-md border border-transparent bg-white px-8 py-3 text-base font-medium text-gray-900 hover:bg-gray-100 sm:w-auto duration-200 hover:scale-105"
                    >{{ $t("store.lookAt") }}</NuxtLink
                  >
                  <AddLibraryButton :game-id="game.id" />
                </div>
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
      class="w-full h-full flex flex-col items-center justify-center bg-zinc-950/50 px-6 py-32 sm:px-12 sm:py-40 lg:px-16 gap-4"
    >
      <h2
        class="uppercase text-xl font-bold tracking-tight text-zinc-700 sm:text-3xl"
      >
        {{ $t("store.noFeatured") }}
      </h2>
      <NuxtLink
        v-if="user?.admin"
        to="/admin/library"
        type="button"
        class="inline-flex items-center gap-x-2 rounded-md bg-zinc-800 px-3 py-1 text-sm font-semibold font-display text-white shadow-sm hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 duration-200 hover:scale-105 active:scale-95"
      >
        <i18n-t
          keypath="store.openFeatured"
          tag="span"
          scope="global"
          class="inline-flex items-center gap-x-1"
        >
          <template #arrow>
            <ArrowTopRightOnSquareIcon class="size-4" />
          </template>
        </i18n-t>
      </NuxtLink>
    </div>

    <StoreView />
  </div>
</template>

<script setup lang="ts">
import { ArrowTopRightOnSquareIcon } from "@heroicons/vue/24/outline";

const recent = await $dropFetch("/api/v1/store/featured");

const user = useUser();

const { t } = useI18n();

useHead({
  title: t("store.title"),
});
</script>
