<template>
  <div
    class="pt-8 lg:pt-0 lg:pl-20 fixed inset-0 flex flex-col overflow-auto bg-zinc-900"
  >
    <div
      class="bg-zinc-950 w-full flex flex-col sm:flex-row items-center gap-2 justify-between pr-2"
    >
      <!--start-->
      <div>
        <div class="pt-4 inline-flex gap-x-2">
          <div
            v-for="[value, { icon }] in Object.entries(components)"
            :key="value"
          >
            <button
              :class="[
                'inline-flex items-center gap-x-1 py-2 px-3 rounded-t-md font-semibold text-sm',
                value == currentMode
                  ? 'bg-zinc-900 text-zinc-100'
                  : 'bg-transparent text-zinc-500',
              ]"
              @click="() => (currentMode = value as GameEditorMode)"
            >
              <component :is="icon" class="size-4" />
              {{ value }}
            </button>
          </div>
        </div>
      </div>
      <div>
        <!-- open in store button -->
        <NuxtLink
          :href="`/store/${game.id}`"
          type="button"
          class="inline-flex w-fit items-center gap-x-2 rounded-md bg-zinc-800 px-3 py-1 text-sm font-semibold font-display text-white shadow-sm hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {{ $t("library.admin.openStore") }}
          <ArrowTopRightOnSquareIcon
            class="-mr-0.5 h-7 w-7 p-1"
            aria-hidden="true"
          />
        </NuxtLink>
      </div>
    </div>
    <component
      :is="components[currentMode].editor"
      v-model="game"
      :unimported-versions="unimportedVersions"
    />
  </div>
</template>

<script setup lang="ts">
import { GameEditorConfiguration, GameEditorMetadata } from "#components";
import {
  ArrowTopRightOnSquareIcon,
  DocumentIcon,
  WrenchIcon,
} from "@heroicons/vue/24/outline";
import type { Component } from "vue";

const route = useRoute();
const gameId = route.params.id.toString();
const { game: rawGame, unimportedVersions } = await $dropFetch(
  `/api/v1/admin/game?id=${encodeURIComponent(gameId)}`,
);
const game = ref(rawGame);

definePageMeta({
  layout: "admin",
});

useHead({
  // To do a title with the game name in it, we need some sort of watch
  title: "Game Editor",
});

enum GameEditorMode {
  Metadata = "Metadata",
  Configuration = "Configuration",
}

const components: {
  [key in GameEditorMode]: { editor: Component; icon: Component };
} = {
  [GameEditorMode.Metadata]: { editor: GameEditorMetadata, icon: DocumentIcon },
  [GameEditorMode.Configuration]: {
    editor: GameEditorConfiguration,
    icon: WrenchIcon,
  },
};

const currentMode = ref<GameEditorMode>(GameEditorMode.Metadata);
</script>
