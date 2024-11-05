<template>
  <div
    class="mx-auto w-full relative flex flex-col justify-center pt-32 xl:pt-24 z-10 overflow-hidden"
  >
    <!-- banner image -->
    <div class="absolute flex top-0 h-fit inset-x-0 h-12 -z-[20]">
      <img :src="useObject(game.mBannerId)" class="w-full h-auto" />
      <div
        class="absolute inset-0 bg-gradient-to-b from-transparent to-80% to-zinc-900"
      />
    </div>
    <!-- main page -->
    <div
      class="max-w-7xl w-full min-h-screen mx-auto bg-zinc-900 px-5 py-4 sm:px-16 sm:py-12 rounded-md"
    >
      <h1
        class="text-3xl md:text-5xl font-bold font-display text-zinc-100 pb-4 border-b border-zinc-800"
      >
        {{ game.mName }}
      </h1>

      <div class="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div
          class="col-start-1 lg:col-start-4 flex flex-col gap-y-6 items-center"
        >
          <img class="w-64 h-auto rounded" :src="useObject(game.mCoverId)" />
          <button
            type="button"
            class="inline-flex items-center gap-x-2 rounded-md bg-blue-600 px-3.5 py-2.5 text-xl font-semibold font-display text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Add to Library
            <PlusIcon class="-mr-0.5 h-7 w-7" aria-hidden="true" />
          </button>
          <div class="inline-flex items-center gap-x-3">
            <span class="text-zinc-100 font-semibold">Available on:</span>
            <component
              v-for="platform in platforms"
              :is="icons[platform]"
              class="text-blue-600 w-6 h-6"
            />
            <span
              v-if="platforms.length == 0"
              class="font-semibold text-blue-600"
              >coming soon</span
            >
          </div>
        </div>

        <div class="row-start-2 lg:row-start-1 lg:col-span-3">
          <p class="text-lg text-zinc-400">
            {{ game.mShortDescription }}
          </p>
          <div class="mt-6 bg-zinc-800 py-4 rounded">
            <VueCarousel :items-to-show="1">
              <VueSlide v-for="image in game.mImageLibrary" :key="image">
                <img
                  class="w-fit h-48 lg:h-96 rounded"
                  :src="useObject(image)"
                />
              </VueSlide>

              <template #addons>
                <VueNavigation />
                <VuePagination />
              </template>
            </VueCarousel>
          </div>

          <div
            v-html="descriptionHTML"
            class="mt-12 prose prose-invert prose-blue max-w-none"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.carousel__icon {
  color: #f4f4f5;
}
.carousel__pagination-button::after {
  background-color: #a1a1aa;
}
.carousel__pagination-button--active::after {
  background-color: #f4f4f5;
}

</style>

<script setup lang="ts">
import { PlusIcon } from "@heroicons/vue/20/solid";
import { Platform, type Game, type GameVersion } from "@prisma/client";
import MarkdownIt from "markdown-it";
import LinuxLogo from "~/components/icons/LinuxLogo.vue";
import WindowsLogo from "~/components/WindowsLogo.vue";

const route = useRoute();
const gameId = route.params.id.toString();

const headers = useRequestHeaders(["cookie"]);
const game = await $fetch<Game & { versions: GameVersion[] }>(
  `/api/v1/games/${gameId}`,
  { headers }
);
const md = MarkdownIt();
const descriptionHTML = md.render(game.mDescription);
const platforms = game.versions
  .map((e) => e.platform)
  .flat()
  .filter((e, i, u) => u.indexOf(e) === i);
const icons = {
  [Platform.Linux]: LinuxLogo,
  [Platform.Windows]: WindowsLogo,
};

useHead({
  title: game.mName,
});
</script>
