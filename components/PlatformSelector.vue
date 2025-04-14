<template>
  <Listbox v-model="typedModel" as="div">
    <ListboxLabel class="block text-sm font-medium leading-6 text-zinc-100"
      ><slot
    /></ListboxLabel>
    <div class="relative mt-2">
      <ListboxButton
        class="relative w-full cursor-default rounded-md bg-zinc-950 py-1.5 pl-3 pr-10 text-left text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm sm:leading-6"
      >
        <span v-if="model" class="flex items-center">
          <component
            :is="PLATFORM_ICONS[model]"
            alt=""
            class="h-5 w-5 flex-shrink-0 text-blue-600"
          />
          <span class="ml-3 block truncate">{{ model }}</span>
        </span>
        <span v-else>Please select a platform...</span>
        <span
          class="pointer-events-none absolute inset-y-0 right-0 ml-3 flex items-center pr-2"
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
          class="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-zinc-950 ring-opacity-5 focus:outline-none sm:text-sm"
        >
          <ListboxOption
            v-for="[name, value] in Object.entries(values)"
            :key="value"
            v-slot="{ active, selected }"
            as="template"
            :value="value"
          >
            <li
              :class="[
                active ? 'bg-blue-600 text-white' : 'text-zinc-100',
                'relative cursor-default select-none py-2 pl-3 pr-9',
              ]"
            >
              <div class="flex items-center">
                <component
                  :is="PLATFORM_ICONS[value]"
                  alt=""
                  :class="[
                    active ? 'text-zinc-100' : 'text-blue-600',
                    'h-5 w-5 flex-shrink-0',
                  ]"
                />
                <span class="ml-3 block truncate">{{ name }}</span>
              </div>

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

const model = defineModel<PlatformClient | undefined>();

const typedModel = computed<PlatformClient | null>({
  get() {
    return model.value || null;
  },
  set(v) {
    if (v === null) return (model.value = undefined);
    model.value = v;
  },
});

const values = Object.fromEntries(Object.entries(PlatformClient));
</script>
