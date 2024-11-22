<template>
  <div
    class="mx-auto bg-zinc-950 w-full relative flex flex-col justify-center pt-32 xl:pt-24 z-10 overflow-hidden"
  >
    <!-- banner image -->
    <div class="absolute flex top-0 h-fit inset-x-0 h-12 -z-[20] pb-4">
      <img :src="useObject(game.mBannerId)" class="blur-sm w-full h-auto" />
      <div
        class="absolute inset-0 bg-gradient-to-b from-transparent to-80% to-zinc-950"
      />
    </div>
    <!-- main page -->
    <div
      :class="[
        'max-w-7xl w-full min-h-screen mx-auto px-5 py-4 sm:px-16 sm:py-12 rounded-xl', // layout stuff
        'bg-zinc-950/90 backdrop-blur-[500px] backdrop-saturate-200 backdrop-brightness-200', // make a soft, colourful glow background
      ]"
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
          <img
            class="transition-all duration-300 hover:scale-105 hover:rotate-[-1deg] w-64 h-auto rounded"
            :src="useObject(game.mCoverId)"
          />
          <button
            type="button"
            class="inline-flex items-center gap-x-2 rounded-md bg-blue-600 px-3.5 py-2.5 text-xl font-semibold font-display text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Add to Library
            <PlusIcon class="-mr-0.5 h-7 w-7" aria-hidden="true" />
          </button>
          <NuxtLink
            v-if="user?.admin"
            :href="`/admin/library/${game.id}`"
            type="button"
            class="inline-flex items-center gap-x-2 rounded-md bg-zinc-800 px-3 py-1 text-sm font-semibold font-display text-white shadow-sm hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Open in Admin Dashboard
            <ArrowTopRightOnSquareIcon
              class="-mr-0.5 h-7 w-7 p-1"
              aria-hidden="true"
            />
          </NuxtLink>
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
          <div class="mt-6 py-4 rounded">
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

          <div>
            <div
              v-if="showPreview"
              v-html="previewHTML"
              class="mt-12 prose prose-invert prose-blue max-w-none"
            />
            <div
              v-else
              v-html="descriptionHTML"
              class="mt-12 prose prose-invert prose-blue max-w-none"
            />

            <button
              v-if="showReadMore"
              class="mt-8 w-full inline-flex items-center gap-x-6"
              @click="() => (showPreview = !showPreview)"
            >
              <div class="grow h-[1px] bg-zinc-700 rounded-full" />
              <span
                class="uppercase text-sm font-semibold font-display text-zinc-600"
                >Click to read {{ showPreview ? "more" : "less" }}</span
              >
              <div class="grow h-[1px] bg-zinc-700 rounded-full" />
            </button>
          </div>
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
  background-color: #3f3f46;
  border-radius: 999999px;
}
.carousel__pagination-button--active::after {
  background-color: #a1a1aa;
}
</style>

<script setup lang="ts">
import { PlusIcon } from "@heroicons/vue/20/solid";
import { ArrowTopRightOnSquareIcon } from "@heroicons/vue/24/outline";
import { Platform, type Game, type GameVersion } from "@prisma/client";
import MarkdownIt from "markdown-it";
import LinuxLogo from "~/components/icons/LinuxLogo.vue";
import WindowsLogo from "~/components/WindowsLogo.vue";

const route = useRoute();
const gameId = route.params.id.toString();

const user = useUser();

const headers = useRequestHeaders(["cookie"]);
const game = await $fetch<Game & { versions: GameVersion[] }>(
  `/api/v1/games/${gameId}`,
  { headers }
);
const md = MarkdownIt();

// Preview description (first 30 lines)
const showPreview = ref(true);
const gameDescriptionCharacters = game.mDescription.split("");

// First new line after x characters
const descriptionSplitIndex = gameDescriptionCharacters.findIndex(
  (v, i, arr) => {
    // If we're at the last element, we return true.
    // So we don't have to handle a -1 from this findIndex
    if (i + 1 == arr.length) return true;
    if (i < 500) return false;
    if (v != "\n") return false;
    return true;
  }
);

const previewDescription = gameDescriptionCharacters
  .slice(0, descriptionSplitIndex + 1) // Slice a character after
  .join("");
const previewHTML = md.render(previewDescription);

const descriptionHTML = md.render(game.mDescription);

const showReadMore = previewHTML != descriptionHTML;
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
