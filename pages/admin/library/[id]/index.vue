<template>
  <div
    class="pt-8 lg:pt-0 lg:pl-20 fixed inset-0 flex flex-col overflow-auto bg-zinc-900"
  >
    <div
      class="bg-zinc-950 w-full flex flex-col sm:flex-row items-center gap-2 justify-between pr-2"
    >
      <!--start-->
      <div>
        <Listbox v-if="false" v-model="currentMode" as="div">
          <div class="relative mt-2">
            <ListboxButton
              class="min-w-[10vw] w-full cursor-default inline-flex items-center gap-x-2 rounded-md bg-zinc-900 py-1.5 pr-2 pl-3 text-left text-zinc-200 outline-1 -outline-offset-1 outline-zinc-700 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
            >
              <span class="col-start-1 row-start-1 truncate">{{
                currentMode
              }}</span>

              <PencilIcon class="ml-auto size-5" />

              <ChevronUpDownIcon
                class="text-gray-500 size-5"
                aria-hidden="true"
              />
            </ListboxButton>

            <transition
              leave-active-class="transition ease-in duration-100"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <ListboxOptions
                class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-white/5 focus:outline-hidden sm:text-sm"
              >
                <ListboxOption
                  v-for="[value] in Object.entries(components)"
                  v-slot="{ active, selected }"
                  :key="value"
                  as="template"
                  :value="value"
                >
                  <li
                    :class="[
                      active
                        ? 'bg-blue-600 text-white outline-hidden'
                        : 'text-zinc-100',
                      'relative cursor-default py-2 pr-9 pl-3 select-none',
                    ]"
                  >
                    <span
                      :class="[
                        selected ? 'font-semibold' : 'font-normal',
                        'block truncate',
                      ]"
                      >{{ value }}</span
                    >

                    <span
                      v-if="selected"
                      class="text-white absolute inset-y-0 right-0 flex items-center pr-4"
                    >
                      <PencilIcon class="size-5" aria-hidden="true" />
                    </span>
                  </li>
                </ListboxOption>
              </ListboxOptions>
            </transition>
          </div>
        </Listbox>

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
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { ChevronUpDownIcon } from "@heroicons/vue/16/solid";
import { GameEditorMetadata, GameEditorVersion } from "#components";
import {
  ArrowTopRightOnSquareIcon,
  DocumentIcon,
  PencilIcon,
  ServerStackIcon,
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
  Versions = "Versions",
}

const components: {
  [key in GameEditorMode]: { editor: Component; icon: Component };
} = {
  [GameEditorMode.Metadata]: { editor: GameEditorMetadata, icon: DocumentIcon },
  [GameEditorMode.Versions]: {
    editor: GameEditorVersion,
    icon: ServerStackIcon,
  },
};

const currentMode = ref<GameEditorMode>(GameEditorMode.Metadata);
</script>
