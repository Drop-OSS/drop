<template>
  <Combobox
    v-model="currentResult"
    as="div"
    nullable
    class="bg-zinc-800 rounded"
  >
    <div class="relative">
      <ComboboxInput
        class="block flex-1 border-0 py-1.5 pl-2 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
        placeholder="Start typing..."
        :display-value="(game) => (game as GameMetadataSearchResult)?.name"
        @change="gameSearchQuery = $event.target.value"
        @blur="gameSearchQuery = ''"
      />
      <ComboboxButton
        class="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none"
      >
        <ChevronUpDownIcon class="size-5 text-gray-400" aria-hidden="true" />
      </ComboboxButton>

      <ComboboxOptions
        class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-white/5 focus:outline-none sm:text-sm"
      >
        <div
          v-if="gameSearchQuery.length < 4"
          class="text-zinc-300 uppercase font-display font-bold text-center p-4"
        >
          Type at least 4 characters to get results
        </div>
        <div
          v-else-if="resultsLoading || results === undefined"
          class="flex items-center justify-center p-2"
        >
          <svg
            aria-hidden="true"
            class="w-8 h-8 text-transparent animate-spin fill-zinc-100"
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
          v-else-if="results.length == 0"
          class="text-zinc-500 uppercase font-display font-bold text-center p-4"
        >
          No results
        </div>
        <ComboboxOption
          v-for="result in results"
          v-else
          :key="result.id"
          v-slot="{ active, selected }"
          :value="result"
          as="template"
        >
          <li
            :class="[
              'relative cursor-default select-none py-2 pl-3 pr-9',
              active ? 'bg-blue-600 text-white outline-none' : 'text-zinc-100',
            ]"
          >
            <span>
              <GameSearchResultWidget :game="result" :raw-icon="false" />
            </span>

            <span
              v-if="selected"
              :class="[
                'absolute inset-y-0 right-0 flex items-center pr-4',
                active ? 'text-white' : 'text-blue-600',
              ]"
            >
              <CheckIcon class="size-5" aria-hidden="true" />
            </span>
          </li>
        </ComboboxOption>
      </ComboboxOptions>
    </div>
  </Combobox>
</template>

<script setup lang="ts">
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/vue";
import { ChevronUpDownIcon } from "@heroicons/vue/24/outline";

import type { GameMetadataSearchResult } from "~/server/internal/metadata/types";

const props = defineProps<{
  search: (query: string) => Promise<Array<GameMetadataSearchResult>>;
}>();

const currentResult = defineModel<GameMetadataSearchResult | undefined>();
const gameSearchQuery = ref("");

const resultsLoading = ref(false);
const results = ref<Array<GameMetadataSearchResult>>();

let timeout: NodeJS.Timeout | undefined = undefined;

watch(gameSearchQuery, async (v) => {
  if (v.length < 4) {
    results.value = [];
    resultsLoading.value = false;
    return;
  }

  if (timeout) clearTimeout(timeout);
  resultsLoading.value = true;
  timeout = setTimeout(async () => {
    results.value = await props.search(v);
    resultsLoading.value = false;
    timeout = undefined;
  }, 600);
});
</script>
