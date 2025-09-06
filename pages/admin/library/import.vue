<template>
  <div class="flex flex-col gap-y-6 w-full max-w-md">
    <Listbox
      as="div"
      :model="currentlySelectedGame"
      @update:model-value="(value) => updateSelectedGame(value)"
    >
      <ListboxLabel class="block text-sm font-medium leading-6 text-zinc-100">
        {{ $t("library.admin.import.selectGame") }}
      </ListboxLabel>
      <div class="relative mt-2">
        <ListboxButton
          class="relative w-full cursor-default rounded-md bg-zinc-950 py-1.5 pl-3 pr-10 text-left text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
        >
          <span v-if="currentlySelectedGame != -1" class="block truncate"
            >{{ games.unimportedGames[currentlySelectedGame].game }}
            <span
              class="px-1 py-0.5 text-xs bg-blue-600/10 rounded-sm ring-1 ring-blue-600 text-blue-400"
              >{{
                games.unimportedGames[currentlySelectedGame].library.name
              }}</span
            ></span
          >
          <span v-else class="block truncate text-zinc-400">{{
            $t("library.admin.import.selectDir")
          }}</span>
          <span
            class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
          >
            <ChevronUpDownIcon
              class="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </span>
        </ListboxButton>

        <transition
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <ListboxOptions
            class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-zinc-800 focus:outline-none sm:text-sm"
          >
            <ListboxOption
              v-for="({ game, library }, gameIdx) in games.unimportedGames"
              :key="game"
              v-slot="{ active }"
              as="template"
              :value="gameIdx"
            >
              <li
                :class="[
                  active ? 'bg-blue-600 text-white' : 'text-zinc-100',
                  'relative cursor-default select-none py-2 pl-3 pr-9',
                ]"
              >
                <span
                  :class="[
                    gameIdx === currentlySelectedGame
                      ? 'font-semibold'
                      : 'font-normal',
                    'inline-flex items-center gap-x-2 block truncate py-1 w-full',
                  ]"
                  >{{ game }}
                  <span
                    class="px-1 py-0.5 text-xs bg-blue-600/10 rounded-sm ring-1 ring-blue-600 text-blue-400"
                    >{{ library.name }}</span
                  ></span
                >

                <span
                  v-if="gameIdx === currentlySelectedGame"
                  :class="[
                    active ? 'text-white' : 'text-blue-600',
                    'absolute inset-y-0 right-0 flex items-center pr-4',
                  ]"
                >
                  <CheckIcon class="h-5 w-5" aria-hidden="true" />
                </span>
              </li>
            </ListboxOption>
            <div
              v-if="games.unimportedGames.length == 0"
              class="w-full uppercase font-display font-bold text-zinc-600 p-2 text-center"
            >
              Nothing to import
            </div>
          </ListboxOptions>
        </transition>
      </div>
    </Listbox>
    <Listbox v-model="currentImportMode" as="div">
      <ListboxLabel class="block text-sm font-medium leading-6 text-zinc-100">
        Import as
      </ListboxLabel>
      <div class="relative mt-2">
        <ListboxButton
          class="relative inline-flex items-center w-full cursor-default rounded-md bg-zinc-950 py-1.5 pl-3 pr-10 text-left text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
        >
          <span class="inline-flex items-top gap-x-2">
            <component
              :is="importModes[currentImportMode].icon"
              class="text-blue-600 size-8 p-1 bg-zinc-800 rounded-sm mt-1"
            />
            <div>
              <h1 class="text-sm font-bold text-zinc-200">
                {{ importModes[currentImportMode].name }}
              </h1>
              <p class="text-xs text-zinc-400 max-w-xs">
                {{ importModes[currentImportMode].description }}
              </p>
            </div>
          </span>
          <span
            class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
          >
            <ChevronUpDownIcon
              class="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </span>
        </ListboxButton>

        <transition
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <ListboxOptions
            class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-zinc-800 focus:outline-none sm:text-sm"
          >
            <ListboxOption
              v-for="[mode, metadata] in Object.entries(importModes)"
              :key="mode"
              v-slot="{ active }"
              as="template"
              :value="mode"
            >
              <li
                :class="[
                  active ? 'bg-blue-600 text-white' : 'text-zinc-100',
                  'relative cursor-default select-none py-2 pl-3 pr-9',
                ]"
              >
                <span
                  :class="[
                    mode == currentImportMode ? 'font-semibold' : 'font-normal',
                    'inline-flex items-center gap-x-2 block truncate py-1 w-full',
                  ]"
                  >{{ metadata.name }}

                  <span
                    v-if="mode == currentImportMode"
                    :class="[
                      active ? 'text-white' : 'text-blue-600',
                      'absolute inset-y-0 right-0 flex items-center pr-4',
                    ]"
                  >
                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                  </span>
                </span>
              </li>
            </ListboxOption>
          </ListboxOptions>
        </transition>
      </div>
    </Listbox>

    <div class="flex items-center justify-between gap-x-8">
      <span class="flex grow flex-col">
        <label
          id="bulkImport-label"
          class="text-sm/6 font-medium text-zinc-100"
          >{{ $t("library.admin.import.bulkImportTitle") }}</label
        >
        <span id="bulkImport-description" class="text-sm text-zinc-400">{{
          $t("library.admin.import.bulkImportDescription")
        }}</span>
      </span>
      <div
        class="group relative inline-flex w-11 shrink-0 rounded-full bg-zinc-800 p-0.5 inset-ring inset-ring-zinc-100/5 outline-offset-2 outline-blue-600 transition-colors duration-200 ease-in-out has-checked:bg-blue-600 has-focus-visible:outline-2"
      >
        <span
          class="size-5 rounded-full bg-white shadow-xs ring-1 ring-zinc-100/5 transition-transform duration-200 ease-in-out group-has-checked:translate-x-5"
        />
        <input
          id="bulkImport"
          v-model="bulkImportMode"
          type="checkbox"
          class="w-auto h-auto opacity-0 absolute inset-0 focus:outline-hidden"
          name="bulkImport"
          aria-labelledby="bulkImport-label"
          aria-describedby="bulkImport-description"
        />
      </div>
    </div>

    <component
      :is="importModes[currentImportMode].component"
      v-if="currentlySelectedGame !== -1"
      :game-name="games.unimportedGames[currentlySelectedGame].game"
      :loading="importLoading"
      :error="importError"
      @import="(...v: unknown[]) => importModes[currentImportMode].import(...v)"
    />
  </div>
</template>

<script setup lang="ts">
import { ImportGame, ImportRedist } from "#components";
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/20/solid";
import { PuzzlePieceIcon, ArchiveBoxIcon } from "@heroicons/vue/24/solid";
import type { FetchError } from "ofetch";
import type { GameMetadataSearchResult } from "~/server/internal/metadata/types";

definePageMeta({
  layout: "admin",
});

type ImportMode = "Game" | "Redist";

const importModes = shallowRef<{
  [key in ImportMode]: {
    name: string;
    description: string;
    icon: Component;
    component: Component;
    import: (...v: unknown[]) => void;
  };
}>({
  Game: {
    name: "Game",
    description: "Games can be added to user libraries, installed, and played.",
    icon: PuzzlePieceIcon,
    component: ImportGame,
    import: importGame_wrapper as (v: unknown) => void,
  },
  Redist: {
    name: "Redistributable",
    description:
      "Redistributables are packaged dependencies for games, that are installed alongside and required to play certain games.",
    icon: ArchiveBoxIcon,
    component: ImportRedist,
    import: importRedist as (v: unknown, k: unknown) => void,
  },
});

const currentImportMode = ref<ImportMode>("Game");

const { t } = useI18n();

const rawGames = await $dropFetch("/api/v1/admin/import/game");
const games = ref(rawGames);
const currentlySelectedGame = ref(-1);
const bulkImportMode = ref(false);

async function updateSelectedGame(value: number) {
  if (currentlySelectedGame.value == value || value == -1) return;
  const option = games.value.unimportedGames[value];
  if (!option) return;

  currentlySelectedGame.value = value;
}

const router = useRouter();

const importLoading = ref(false);
const importError = ref<string | undefined>();
async function importGame(metadata: GameMetadataSearchResult | undefined) {
  const option = games.value.unimportedGames[currentlySelectedGame.value];

  const { taskId } = await $dropFetch("/api/v1/admin/import/game", {
    method: "POST",
    body: {
      path: option.game,
      library: option.library.id,
      metadata,
    },
  });

  if (!bulkImportMode.value) {
    router.push(`/admin/task/${taskId}`);
  } else {
    games.value.unimportedGames.splice(currentlySelectedGame.value, 1);
    currentlySelectedGame.value = -1;
  }
}
async function importGame_wrapper(
  metadata: GameMetadataSearchResult | undefined,
) {
  importLoading.value = true;
  importError.value = undefined;
  try {
    await importGame(metadata);
  } catch (error) {
    console.warn(error);
    importError.value =
      (error as FetchError)?.message || t("errors.unknown");
  }
  importLoading.value = false;
}

async function importRedist(data: object, platform: object | undefined) {
  importLoading.value = true;
  importError.value = undefined;
  try {
    const option = games.value.unimportedGames[currentlySelectedGame.value];

    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.append(
        key,
        value,
      );
    }

    if (platform) {
      for (const [key, value] of Object.entries(platform)) {
        // Because we know there will be no file, and we need to handle more complex objects for
        // the platform, we do this.
        // Maybe we shouldn't.
        formData.append(
          `platform.${key}`,
          typeof value === "object" ? JSON.stringify(value) : value,
        );
      }
    }

    formData.append("library", option.library.id);
    formData.append("path", option.game);
    const redist = await $dropFetch("/api/v1/admin/import/redist", {
      body: formData,
      method: "POST",
    });

    if (!bulkImportMode.value) {
      router.push(`/admin/library/r/${redist.id}`);
    } else {
      games.value.unimportedGames.splice(currentlySelectedGame.value, 1);
      currentlySelectedGame.value = -1;
    }
  } catch (error) {
    console.warn(error);
    importError.value =
      (error as FetchError)?.message || t("errors.unknown");
  }
  importLoading.value = false;
}
</script>
