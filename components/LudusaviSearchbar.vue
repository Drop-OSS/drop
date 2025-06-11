<template>
  <Combobox v-model="selectedGame" as="div" @update:model-value="query = ''">
    <ComboboxLabel class="block text-sm/6 font-medium text-zinc-100">{{
      $t("library.admin.cloudSaves.search")
    }}</ComboboxLabel>
    <div class="relative mt-2">
      <ComboboxInput
        class="block w-full rounded-md bg-zinc-900 py-1.5 pr-12 pl-3 text-base text-zinc-100 outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
        :display-value="(value) => value as string"
        @change="query = $event.target.value"
        @blur="query = ''"
      />
      <ComboboxButton
        class="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-hidden"
      >
        <ChevronUpDownIcon class="size-5 text-gray-400" aria-hidden="true" />
      </ComboboxButton>

      <ComboboxOptions
        v-if="searchResults.length > 0"
        class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-950 py-1 text-base shadow-lg ring-1 ring-white/5 focus:outline-hidden sm:text-sm"
      >
        <ComboboxOption
          v-for="result in searchResults"
          :key="result"
          v-slot="{ active, selected }"
          :value="result"
          as="template"
        >
          <li
            :class="[
              'relative cursor-default py-2 pr-9 pl-3 select-none',
              active
                ? 'bg-blue-600 text-white outline-hidden'
                : 'text-zinc-100',
            ]"
          >
            <span :class="['block truncate', selected && 'font-semibold']">
              {{ result }}
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
import { ref } from "vue";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/20/solid";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxLabel,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/vue";

const emit = defineEmits<{
  (e: "update", id: string): void;
}>();

const props = defineProps<{ default?: string }>();

const query = ref("");
const selectedGame = ref<string | null>(props.default ?? null);

const searchResults = ref<Array<string>>([]);

let searchTimeout: NodeJS.Timeout | null = null;
watch(query, (name) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (!name) return;
  searchResults.value = [];
  searchTimeout = setTimeout(async () => {
    const results = await $dropFetch("/api/v1/admin/game/cloudsaves/search", {
      query: { name },
    });
    searchResults.value = results.map((e) => e.name);
  }, 100);
});

watch(selectedGame, (v) => {
  if (!v) return;
  emit("update", v);
});
</script>
