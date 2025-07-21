<template>
  <div>
    <div class="inline-flex gap-1 items-center flex-wrap">
      <span
        v-for="item in enabledItems"
        :key="item.param"
        class="inline-flex items-center gap-x-0.5 rounded-md bg-blue-600/10 px-2 py-1 text-xs font-medium text-blue-500 ring-1 ring-blue-800 ring-inset"
      >
        {{ item.name }}
        <button
          type="button"
          class="group relative -mr-1 size-3.5 rounded-xs hover:bg-blue-600/20"
          @click="() => remove(item.param)"
        >
          <span class="sr-only">Remove</span>
          <svg
            viewBox="0 0 14 14"
            class="size-3.5 stroke-blue-500 group-hover:stroke-blue-400"
          >
            <path d="M4 4l6 6m0-6l-6 6" />
          </svg>
          <span class="absolute -inset-1" />
        </button>
      </span>
      <span v-if="enabledItems.length == 0" class="font-display uppercase text-xs font-bold text-zinc-700">
        No items selected.
      </span>
    </div>
    <Combobox as="div" @update:model-value="add">
      <div class="relative mt-2">
        <ComboboxInput
          class="block w-full rounded-md bg-zinc-900 py-1.5 pr-12 pl-3 text-base text-zinc-100 outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
          :display-value="(item) => (item as StoreSortOption)?.name"
          placeholder="Start typing..."
          @change="search = $event.target.value"
          @blur="search = ''"
        />
        <ComboboxButton
          class="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-hidden"
        >
          <ChevronDownIcon class="size-5 text-gray-400" aria-hidden="true" />
        </ComboboxButton>

        <ComboboxOptions
          v-if="filteredItems.length > 0 || search.length > 0"
          class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-white/5 focus:outline-hidden sm:text-sm"
        >
          <ComboboxOption
            v-for="item in filteredItems"
            :key="item.param"
            v-slot="{ active }"
            :value="item.param"
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
              <span class="block truncate">
                {{ item.name }}
              </span>
            </li>
          </ComboboxOption>
        </ComboboxOptions>
      </div>
    </Combobox>
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon } from "@heroicons/vue/20/solid";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/vue";
const props = defineProps<{
  items: Array<StoreSortOption>;
}>();

const model = defineModel<{ [key: string]: boolean }>();

const search = ref("");
const filteredItems = computed(() =>
  props.items.filter(
    (item) =>
      !model.value?.[item.param] &&
      item.name.toLowerCase().includes(search.value.toLowerCase()),
  ),
);

const enabledItems = computed(() =>
  props.items.filter((e) => model.value?.[e.param]),
);

function add(item: string) {
  search.value = "";
  model.value ??= {};
  model.value[item] = true;
}

function remove(item: string){
    model.value ??= {};
    model.value[item] = false;
}
</script>
