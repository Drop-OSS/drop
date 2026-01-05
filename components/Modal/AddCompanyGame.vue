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
          <SelectorGame v-model="currentGame" :search="search" />
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
import { DialogTitle } from "@headlessui/vue";
import { FetchError } from "ofetch";
import type { SerializeObject } from "nitropack";
import { XCircleIcon } from "@heroicons/vue/24/solid";
import type { GameMetadataSearchResult } from "~/server/internal/metadata/types";

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

const { t } = useI18n();

const open = defineModel<boolean>({ required: true });

const currentGame = ref<GameMetadataSearchResult>();
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
      addError.value = e.statusMessage ?? e.message ?? t("errors.unknown");
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

async function search(query: string) {
  return await $dropFetch("/api/v1/admin/search/game", { query: { q: query } });
}
</script>
