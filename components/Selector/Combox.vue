<template>
  <Combobox
    as="div"
    nullable
    :immediate="true"
    :model-value="model"
    class="bg-zinc-800 rounded"
    @update:model-value="updateModelValue"
  >
    <div class="relative">
      <ComboboxInput
        :key="model?.id ?? 'off'"
        class="block flex-1 border-0 py-1.5 pl-2 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
        placeholder="Start typing..."
        :display-value="(v) => (v ? props.display(v as T) : '')"
        @change="query = $event.target.value"
        @blur="query = ''"
      />
      <ComboboxButton
        class="absolute inset-0 right-0 flex items-center justify-end rounded-r-md px-2 focus:outline-none"
      >
        <ChevronUpDownIcon class="size-5 text-gray-400" aria-hidden="true" />
      </ComboboxButton>

      <ComboboxOptions
        class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-white/5 focus:outline-none sm:text-sm"
      >
        <div
          v-if="results.length == 0"
          class="text-zinc-300 uppercase font-display font-bold text-center p-4"
        >
          No results.
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
              <slot :value="result" />
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

<script setup lang="ts" generic="T extends { id: string }">
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/vue";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/24/outline";

const props = defineProps<{
  search: (query: string) => T[];
  display: (value: T) => string;
}>();

const model = defineModel<T | undefined>();
const query = ref("");

const results = computed(() => props.search(query.value));

function updateModelValue(v: T) {
  model.value = v;
}
</script>
