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
          <span class="sr-only">{{ $t("common.remove") }}</span>
          <svg
            viewBox="0 0 14 14"
            class="size-3.5 stroke-blue-500 group-hover:stroke-blue-400"
          >
            <path d="M4 4l6 6m0-6l-6 6" />
          </svg>
          <span class="absolute -inset-1" />
        </button>
      </span>
      <span
        v-if="enabledItems.length == 0"
        class="font-display uppercase text-xs font-bold text-zinc-700"
      >
        {{ $t("common.noSelected") }}
      </span>
    </div>
    <Combobox as="div" @update:model-value="add">
      <div class="relative mt-2">
        <ComboboxInput
          class="block w-full rounded-md bg-zinc-900 py-1.5 pr-12 pl-3 text-base text-zinc-100 outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
          :display-value="(item) => (item as StoreSortOption)?.name"
          :placeholder="$t('common.components.multiitem.placeholder')"
          @change="search = $event.target.value"
          @blur="search = ''"
        />
        <ComboboxButton
          class="absolute inset-0 flex items-center justify-end rounded-r-md px-2 focus:outline-hidden"
        >
          <ChevronDownIcon class="size-5 text-gray-400" aria-hidden="true" />
        </ComboboxButton>

        <ComboboxOptions
          v-if="filteredItems.length > 0 || search.length > 0"
          class="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-white/5 focus:outline-hidden sm:text-sm"
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
          <ComboboxOption
            v-if="$props.create"
            v-slot="{ active }"
            :value="CREATE_PREFIX + search"
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
                {{ $t("common.components.multiitem.new", [search]) }}
              </span>
            </li>
          </ComboboxOption>
        </ComboboxOptions>

        <div
          v-if="createLoading"
          class="absolute inset-0 bg-zinc-950 flex items-center justify-center"
        >
          <div role="status">
            <svg
              aria-hidden="true"
              class="size-8 text-transparent animate-spin fill-white"
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
            <span class="sr-only">{{ $t("common.srLoading") }}</span>
          </div>
        </div>
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
  create?: (value: string) => Promise<string>;
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

// I do not love how this works, but it's okay for now
const CREATE_PREFIX = "CREATE";

const createLoading = ref(false);
function add(item: string) {
  if (item.startsWith(CREATE_PREFIX)) {
    if (!props.create) return;
    const value = item.substring(CREATE_PREFIX.length);
    createLoading.value = true;
    props
      .create(value)
      .then(
        (result) => {
          add(result);
        },
        (err) => {
          createModal(
            ModalType.Notification,
            {
              title: "Failed to create value",
              description: err,
            },
            (_, c) => c(),
          );
        },
      )
      .finally(() => {
        createLoading.value = false;
      });
    return;
  }
  search.value = "";
  model.value ??= {};
  model.value[item] = true;
}

function remove(item: string) {
  model.value ??= {};
  model.value[item] = false;
}
</script>
