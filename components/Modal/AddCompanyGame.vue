<template>
  <ModalTemplate v-model="open">
    <template #default>
      <div>
        <DialogTitle as="h3" class="text-lg font-medium leading-6 text-white">
          {{ $t("library.admin.metadata.companies.addGame.title") }}
        </DialogTitle>
        <p class="mt-1 text-zinc-400 text-sm">
          {{ $t("library.admin.metadata.companies.addGame.description") }}
        </p>
      </div>
      <div class="mt-2">
        <form @submit.prevent="() => addGame()">
          <Listbox v-model="currentGame" as="div">
            <ListboxLabel
              class="block text-sm font-medium leading-6 text-zinc-100"
              >{{ $t("library.admin.import.selectGameSearch") }}</ListboxLabel
            >
            <div class="relative mt-2">
              <ListboxButton
                class="relative w-full cursor-default rounded-md bg-zinc-950 py-1.5 pl-3 pr-10 text-left text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
              >
                <GameSearchResultWidget
                  v-if="currentGame"
                  :game="currentGame"
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
                    v-for="result in metadataGames"
                    :key="result.id"
                    v-slot="{ active }"
                    as="template"
                    :value="result"
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
                  <p
                    v-if="metadataGames.length == 0"
                    class="w-full text-center p-2 uppercase font-display text-zinc-700 font-bold"
                  >
                    {{ $t("library.admin.metadata.companies.addGame.noGames") }}
                  </p>
                </ListboxOptions>
              </transition>
            </div>
          </Listbox>
          <div class="mt-6 flex items-center justify-between gap-3">
            <label
              id="published-label"
              for="published"
              class="font-medium text-md text-zinc-100"
              >{{
                $t("library.admin.metadata.companies.addGame.publisher")
              }}</label
            >

            <div
              class="group/published relative inline-flex w-11 shrink-0 rounded-full p-0.5 inset-ring outline-offset-2 transition-colors duration-200 ease-in-out has-focus-visible:outline-2 bg-white/5 inset-ring-white/10 outline-blue-500 has-checked:bg-blue-500"
            >
              <span
                class="size-5 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-checked/published:translate-x-5"
              />
              <input
                id="published"
                v-model="published"
                type="checkbox"
                class="w-auto h-auto opacity-0 absolute inset-0 focus:outline-hidden"
                aria-labelledby="published-label"
              />
            </div>
          </div>
          <div class="mt-2 flex items-center justify-between gap-3">
            <label
              id="developer-label"
              for="developer"
              class="font-medium text-md text-zinc-100"
              >{{
                $t("library.admin.metadata.companies.addGame.developer")
              }}</label
            >

            <div
              class="group/developer relative inline-flex w-11 shrink-0 rounded-full p-0.5 inset-ring outline-offset-2 transition-colors duration-200 ease-in-out has-focus-visible:outline-2 bg-white/5 inset-ring-white/10 outline-blue-500 has-checked:bg-blue-500"
            >
              <span
                class="size-5 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-checked/developer:translate-x-5"
              />
              <input
                id="developer"
                v-model="developed"
                type="checkbox"
                class="w-auto h-auto opacity-0 absolute inset-0 focus:outline-hidden"
                aria-labelledby="developer-label"
              />
            </div>
          </div>
          <button class="hidden" type="submit" />
        </form>
      </div>

      <div v-if="addError" class="mt-3 rounded-md bg-red-600/10 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-600">
              {{ addError }}
            </h3>
          </div>
        </div>
      </div>
    </template>

    <template #buttons="{ close }">
      <LoadingButton
        :loading="addGameLoading"
        :disabled="!(currentGame && (developed || published))"
        class="w-full sm:w-fit"
        @click="() => addGame()"
      >
        {{ $t("common.add") }}
      </LoadingButton>
      <button
        ref="cancelButtonRef"
        type="button"
        class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 hover:bg-zinc-900 sm:mt-0 sm:w-auto"
        @click="() => close()"
      >
        {{ $t("cancel") }}
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { GameModel } from "~/prisma/client/models";
import {
  DialogTitle,
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import type { GameMetadataSearchResult } from "~/server/internal/metadata/types";
import { FetchError } from "ofetch";
import type { SerializeObject } from "nitropack";
import { XCircleIcon } from "@heroicons/vue/24/solid";

const props = defineProps<{
  companyId: string;
  exclude?: string[];
}>();

const emit = defineEmits<{
  created: [
    game: SerializeObject<GameModel>,
    published: boolean,
    developed: boolean,
  ];
}>();

const games = await $dropFetch("/api/v1/admin/game");
const metadataGames = computed(() =>
  games
    .filter((e) => !(props.exclude ?? []).includes(e.id))
    .map(
      (e) =>
        ({
          id: e.id,
          name: e.mName,
          icon: useObject(e.mIconObjectId),
          description: e.mShortDescription,
        }) satisfies Omit<GameMetadataSearchResult, "year">,
    ),
);

const { t } = useI18n();

const open = defineModel<boolean>({ required: true });

const currentGame = ref<(typeof metadataGames.value)[number]>();
const developed = ref(false);
const published = ref(false);
const addGameLoading = ref(false);
const addError = ref<string | undefined>(undefined);

async function addGame() {
  if (!currentGame.value) return;
  addGameLoading.value = true;

  try {
    const game = await $dropFetch("/api/v1/admin/company/:id/game", {
      method: "POST",
      params: { id: props.companyId },
      body: {
        id: currentGame.value.id,
        developed: developed.value,
        published: published.value,
      },
    });
    emit("created", game, published.value, developed.value);
  } catch (e) {
    if (e instanceof FetchError) {
      addError.value = e.message ?? t("errors.unknown");
    } else {
      throw e;
    }
  } finally {
    currentGame.value = undefined;
    developed.value = false;
    published.value = false;
    addGameLoading.value = false;
    open.value = false;
  }
}
</script>
