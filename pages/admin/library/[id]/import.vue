<template>
  <Listbox
    as="div"
    class="max-w-md"
    v-on:update:model-value="(value) => updateCurrentlySelectedVersion(value)"
    :model-value="currentlySelectedVersion"
  >
    <ListboxLabel class="block text-sm font-medium leading-6 text-zinc-100"
      >Select version to import</ListboxLabel
    >
    <div class="relative mt-2">
      <ListboxButton
        class="relative w-full cursor-default rounded-md bg-zinc-950 py-1.5 pl-3 pr-10 text-left text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
      >
        <span v-if="currentlySelectedVersion != -1" class="block truncate">{{
          versions[currentlySelectedVersion]
        }}</span>
        <span v-else class="block truncate text-zinc-600"
          >Please select a directory...</span
        >
        <span
          class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
        >
          <ChevronUpDownIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
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
            v-for="(version, versionIdx) in versions"
            :key="version"
            :value="versionIdx"
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
                >{{ version }}</span
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
</template>

<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/20/solid";

definePageMeta({
  layout: "admin",
});

const route = useRoute();
const headers = useRequestHeaders(["cookie"]);
const gameId = route.params.id.toString();
const versions = await $fetch(
  `/api/v1/admin/import/version?id=${encodeURIComponent(gameId)}`,
  {
    headers,
  }
);
const currentlySelectedVersion = ref(-1);

async function updateCurrentlySelectedVersion(value: number) {
  if (currentlySelectedVersion.value == value) return;
  currentlySelectedVersion.value = value;
  const version = versions[currentlySelectedVersion.value];
  const results = await $fetch(
    `/api/v1/admin/import/version/preload?id=${encodeURIComponent(
      gameId
    )}&version=${encodeURIComponent(version)}`
  );
}
</script>
