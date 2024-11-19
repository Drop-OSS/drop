<template>
  <div class="flex flex-col gap-y-4">
    <Listbox
      as="div"
      class="max-w-md"
      v-on:update:model-value="(value) => updateSelectedGame(value)"
      :model="currentlySelectedGame"
    >
      <ListboxLabel class="block text-sm font-medium leading-6 text-zinc-100"
        >Select game to import</ListboxLabel
      >
      <div class="relative mt-2">
        <ListboxButton
          class="relative w-full cursor-default rounded-md bg-zinc-950 py-1.5 pl-3 pr-10 text-left text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
        >
          <span v-if="currentlySelectedGame != -1" class="block truncate">{{
            games.unimportedGames[currentlySelectedGame]
          }}</span>
          <span v-else class="block truncate text-zinc-400"
            >Please select a directory...</span
          >
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
              as="template"
              v-for="(game, gameIdx) in games.unimportedGames"
              :key="game"
              :value="gameIdx"
              v-slot="{ active, selected }"
            >
              <li
                :class="[
                  active ? 'bg-blue-600 text-white' : 'text-zinc-100',
                  'relative cursor-default select-none py-2 pl-3 pr-9',
                ]"
              >
                <span
                  :class="[
                    selected ? 'font-semibold' : 'font-normal',
                    'block truncate',
                  ]"
                  >{{ game }}</span
                >

                <span
                  v-if="selected"
                  :class="[
                    active ? 'text-white' : 'text-blue-600',
                    'absolute inset-y-0 right-0 flex items-center pr-4',
                  ]"
                >
                  <CheckIcon class="h-5 w-5" aria-hidden="true" />
                </span>
              </li>
            </ListboxOption>
          </ListboxOptions>
        </transition>
      </div>
    </Listbox>

    <Listbox
      as="div"
      class="max-w-md"
      v-if="metadataResults"
      v-model="currentlySelectedMetadata"
    >
      <ListboxLabel class="block text-sm font-medium leading-6 text-zinc-100"
        >Select game</ListboxLabel
      >
      <div class="relative mt-2">
        <ListboxButton
          class="relative w-full cursor-default rounded-md bg-zinc-950 py-1.5 pl-3 pr-10 text-left text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
        >
          <GameSearchResultWidget
            v-if="currentlySelectedMetadata != -1"
            :game="metadataResults[currentlySelectedMetadata]"
          />
          <span v-else class="block truncate text-zinc-600"
            >Please select a game...</span
          >
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
            class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
          >
            <ListboxOption
              as="template"
              v-for="(result, resultIdx) in metadataResults"
              :key="result.id"
              :value="resultIdx"
              v-slot="{ active, selected }"
            >
              <li
                :class="[
                  active ? 'bg-blue-600 text-white' : 'text-zinc-100',
                  'relative cursor-default select-none py-2 pl-3 pr-9',
                ]"
              >
                <GameSearchResultWidget :game="result" />
              </li>
            </ListboxOption>
          </ListboxOptions>
        </transition>
      </div>
    </Listbox>
    <div
      v-else-if="currentlySelectedGame != -1"
      role="status"
      class="inline-flex text-zinc-100 font-display font-semibold items-center gap-x-4"
    >
      Loading game results...
      <svg
        aria-hidden="true"
        class="w-6 h-6 text-transparent animate-spin fill-white"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
      <span class="sr-only">Loading...</span>
    </div>

    <div v-if="currentlySelectedGame !== -1 && currentlySelectedMetadata !== -1">
      <LoadingButton
        @click="() => importGame_wrapper()"
        class="w-fit"
        :loading="importLoading"
        >Import</LoadingButton
      >

      <div v-if="importError" class="mt-4 w-fit rounded-md bg-red-600/10 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-600">
              {{ importError }}
            </h3>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { XCircleIcon } from "@heroicons/vue/16/solid";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/20/solid";
import type { GameMetadataSearchResult } from "~/server/internal/metadata/types";

definePageMeta({
  layout: "admin",
});

const headers = useRequestHeaders(["cookie"]);
const games = await $fetch("/api/v1/admin/import/game", { headers });

const currentlySelectedGame = ref(-1);

async function updateSelectedGame(value: number) {
  if (currentlySelectedGame.value == value) return;
  currentlySelectedGame.value = value;
  if (currentlySelectedGame.value == -1) return;
  const game = games.unimportedGames[currentlySelectedGame.value];
  if (!game) return;

  metadataResults.value = undefined;
  currentlySelectedMetadata.value = -1;

  const results = await $fetch(
    `/api/v1/admin/import/game/search?q=${encodeURIComponent(game)}`
  );
  metadataResults.value = results;
}

const metadataResults = ref<Array<GameMetadataSearchResult> | undefined>();
const currentlySelectedMetadata = ref(-1);

const router = useRouter();

const importLoading = ref(false);
const importError = ref<string | undefined>();
async function importGame() {
  if (!metadataResults.value) return;

  const game = await $fetch("/api/v1/admin/import/game", {
    method: "POST",
    body: {
      path: games.unimportedGames[currentlySelectedGame.value],
      metadata: metadataResults.value[currentlySelectedMetadata.value],
    },
  });

  router.push(`/admin/library/${game.id}`);
}
function importGame_wrapper() {
  importLoading.value = true;
  importError.value = undefined;
  importGame()
    .catch((error) => {
      importError.value = error?.statusMessage || "An unknown error occurred.";
    })
    .finally(() => {
      importLoading.value = false;
    });
}
</script>
