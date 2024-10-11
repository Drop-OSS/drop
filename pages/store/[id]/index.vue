<template>
  <div
    class="mx-auto w-full relative flex flex-col justify-center pt-24 z-10 overflow-hidden"
  >
    <!-- banner image -->
    <div class="absolute flex top-0 h-fit inset-x-0 h-12 -z-[20]">
      <img :src="useObject(game.mBannerId)" class="w-full h-auto" />
      <div
        class="absolute inset-0 bg-gradient-to-b from-transparent to-80% to-zinc-900"
      />
    </div>
    <!-- main page -->
    <div class="max-w-7xl w-full mx-auto bg-zinc-900 px-16 py-12 rounded-md">
      <h1
        class="text-5xl font-bold font-display text-zinc-100 pb-4 border-b border-zinc-800"
      >
        {{ game.mName }}
      </h1>

      <div class="mt-8 grid grid-cols-4 gap-x-10">
        <div class="col-span-3">
          <p class="text-lg text-zinc-400">
            {{ game.mShortDescription }}
          </p>
          <div
            class="mt-6 flex flex-row overflow-x-auto max-w-full p-4 bg-zinc-800 rounded gap-x-2"
          >
            <img
              v-for="image in game.mImageLibrary"
              class="h-64 w-auto rounded"
              :src="useObject(image)"
            />
          </div>
          <div
            v-html="descriptionHTML"
            class="mt-12 prose prose-invert prose-blue max-w-none"
          />
        </div>

        <div class="flex flex-col gap-y-6 items-center">
          <img class="w-full h-auto rounded" :src="useObject(game.mCoverId)" />
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PlusIcon } from "@heroicons/vue/20/solid";
import { Platform, type Game, type GameVersion } from "@prisma/client";
import MarkdownIt from "markdown-it";
import LinuxLogo from "~/components/LinuxLogo.vue";
import WindowsLogo from "~/components/WindowsLogo.vue";

const route = useRoute();
const gameId = route.params.id.toString();

const game = await $fetch<Game & { versions: GameVersion[] }>(
  `/api/v1/games/${gameId}`
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
</script>
