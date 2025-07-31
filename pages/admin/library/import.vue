<template>
  <div class="flex flex-col gap-y-6 w-full max-w-md">
    <Listbox
      as="div"
      :model="currentlySelectedGame"
      @update:model-value="(value) => updateSelectedGame_wrapper(value)"
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

    <div v-if="currentlySelectedGame !== -1" class="flex flex-col gap-y-4">
      <!-- without metadata option -->
      <div>
        <LoadingButton
          class="w-fit"
          :loading="importLoading"
          @click="() => importGame_wrapper(false)"
        >
          {{ $t("library.admin.import.withoutMetadata") }}
        </LoadingButton>
      </div>

      <!-- divider -->
      <div
        class="inline-flex items-center gap-x-4 text-zinc-600 font-display font-bold"
      >
        <div class="h-[1px] grow bg-zinc-800" />
        {{ $t("auth.signin.or") }}
        <div class="h-[1px] grow bg-zinc-800" />
      </div>

      <!-- with metadata option -->

      <div class="flex flex-col gap-y-4">
        <form @submit.prevent="() => searchGame()">
          <label
            for="searchTerm"
            class="block text-sm/6 font-medium text-zinc-100"
            >{{ $t("library.admin.import.search") }}</label
          >
          <div class="mt-2 flex">
            <div class="-mr-px grid grow grid-cols-1 focus-within:relative">
              <input
                id="searchTerm"
                v-model="gameSearchTerm"
                type="text"
                name="searchTerm"
                class="col-start-1 row-start-1 block w-full rounded-l-md bg-zinc-950 py-1.5 px-3 text-base text-zinc-100 outline-1 -outline-offset-1 outline-zinc-800 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
                :placeholder="$t('library.admin.import.searchPlaceholder')"
              />
            </div>
            <LoadingButton
              :loading="gameSearchLoading"
              :style="'none'"
              type="submit"
              class="w-24 flex shrink-0 items-center justify-center gap-x-1.5 rounded-r-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 outline-1 -outline-offset-1 outline-zinc-800 hover:bg-zinc-900 focus:relative focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600"
            >
              <MagnifyingGlassIcon
                class="-ml-0.5 size-4 text-gray-400"
                aria-hidden="true"
              />
              {{ $t("library.admin.import.search") }}
            </LoadingButton>
          </div>
        </form>

        <Listbox
          v-if="metadataResults && metadataResults.length > 0"
          v-model="currentlySelectedMetadata"
          as="div"
        >
          <ListboxLabel
            class="block text-sm font-medium leading-6 text-zinc-100"
            >{{ $t("library.admin.import.selectGameSearch") }}</ListboxLabel
          >
          <div class="relative mt-2">
            <ListboxButton
              class="relative w-full cursor-default rounded-md bg-zinc-950 py-1.5 pl-3 pr-10 text-left text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
            >
              <GameSearchResultWidget
                v-if="currentlySelectedMetadata != -1"
                :game="metadataResults[currentlySelectedMetadata]"
              />
              <span v-else class="block truncate text-zinc-600">
                {{ $t("library.admin.import.selectGamePlaceholder") }}
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
                class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
              >
                <ListboxOption
                  v-for="(result, resultIdx) in metadataResults"
                  :key="result.id"
                  v-slot="{ active }"
                  as="template"
                  :value="resultIdx"
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
          v-else-if="gameSearchResultsLoading"
          role="status"
          class="inline-flex text-zinc-100 font-display font-semibold items-center gap-x-4"
        >
          {{ $t("library.admin.import.loading") }}
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
        </div>

        <div
          v-if="gameSearchResultsError"
          class="w-fit rounded-md bg-red-600/10 p-4"
        >
          <div class="flex">
            <div class="flex-shrink-0">
              <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-600">
                {{ gameSearchResultsError }}
              </h3>
            </div>
          </div>
        </div>

        <div>
          <LoadingButton
            class="w-fit"
            :loading="importLoading"
            :disabled="currentlySelectedMetadata === -1"
            @click="() => importGame_wrapper()"
          >
            {{ $t("library.admin.import.import") }}
          </LoadingButton>

          <div
            v-if="importError"
            class="mt-4 w-fit rounded-md bg-red-600/10 p-4"
          >
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
import { MagnifyingGlassIcon } from "@heroicons/vue/24/outline";
import type { GameMetadataSearchResult } from "~/server/internal/metadata/types";

definePageMeta({
  layout: "admin",
});

const { t } = useI18n();

const rawGames = await $dropFetch("/api/v1/admin/import/game");
const games = ref(rawGames);
const currentlySelectedGame = ref(-1);
const gameSearchResultsLoading = ref(false);
const gameSearchResultsError = ref<string | undefined>();
const gameSearchTerm = ref("");
const gameSearchLoading = ref(false);
const bulkImportMode = ref(false);

async function updateSelectedGame(value: number) {
  if (currentlySelectedGame.value == value) return;
  currentlySelectedGame.value = value;
  if (currentlySelectedGame.value == -1) return;
  const option = games.value.unimportedGames[currentlySelectedGame.value];
  if (!option) return;

  metadataResults.value = undefined;
  currentlySelectedMetadata.value = -1;
  gameSearchTerm.value = option.game;

  await searchGame();
}

async function searchGame() {
  gameSearchResultsError.value = undefined;
  gameSearchLoading.value = true;
  try {
    const results = await $dropFetch(
      `/api/v1/admin/import/game/search?q=${encodeURIComponent(gameSearchTerm.value)}`,
    );
    metadataResults.value = results;
    gameSearchLoading.value = false;
  } catch (e) {
    gameSearchLoading.value = false;

    throw e;
  }
}

function updateSelectedGame_wrapper(value: number) {
  gameSearchResultsLoading.value = true;
  updateSelectedGame(value)
    .catch((error) => {
      gameSearchResultsError.value = error.statusMessage || t("errors.unknown");
    })
    .finally(() => {
      gameSearchResultsLoading.value = false;
    });
}

const metadataResults = ref<Array<GameMetadataSearchResult> | undefined>();
const currentlySelectedMetadata = ref(-1);

const router = useRouter();

const importLoading = ref(false);
const importError = ref<string | undefined>();
async function importGame(useMetadata: boolean) {
  if (!metadataResults.value && useMetadata) return;

  const metadata =
    useMetadata && metadataResults.value
      ? metadataResults.value[currentlySelectedMetadata.value]
      : undefined;
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
    gameSearchResultsError.value = undefined;
  }
}
function importGame_wrapper(metadata = true) {
  importLoading.value = true;
  importError.value = undefined;
  importGame(metadata)
    .catch((error) => {
      importError.value = error?.statusMessage || t("errors.unknown");
    })
    .finally(() => {
      importLoading.value = false;
    });
}
</script>
