<template>
  <Listbox as="div" v-model="installDir">
    <ListboxLabel class="block text-sm/6 font-medium text-ink-100"
      >Install to</ListboxLabel
    >
    <div class="relative mt-2">
      <ListboxButton
        class="relative w-full cursor-default rounded-md bg-surface-800 py-1.5 pl-3 pr-10 text-left text-ink-100 shadow-sm ring-1 ring-inset ring-surface-700 focus:outline-none focus:ring-2 focus:ring-accent-600 sm:text-sm/6"
      >
        <span class="block truncate">{{ installDirs[installDir] }}</span>
        <span
          class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
        >
          <ChevronUpDownIcon class="h-5 w-5 text-ink-400" aria-hidden="true" />
        </span>
      </ListboxButton>

      <transition
        leave-active-class="transition ease-in duration-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <ListboxOptions
          class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-surface-900 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
        >
          <ListboxOption
            as="template"
            v-for="(dir, dirIdx) in installDirs"
            :key="dir"
            :value="dirIdx"
            v-slot="{ active, selected }"
          >
            <li
              :class="[
                active ? 'bg-accent-600 text-white' : 'text-ink-300',
                'relative cursor-default select-none py-2 pl-3 pr-9',
              ]"
            >
              <span
                :class="[
                  selected ? 'font-semibold text-ink-100' : 'font-normal',
                  'block truncate',
                ]"
                >{{ dir }}</span
              >

              <span
                v-if="selected"
                :class="[
                  active ? 'text-white' : 'text-accent-600',
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
    <div class="text-ink-400 text-sm mt-2">
      Add more install directories in
      <PageWidget to="/settings/downloads">
        <WrenchIcon class="size-3" />
        Settings
      </PageWidget>
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
import {
  CheckIcon,
  ChevronUpDownIcon,
  WrenchIcon,
} from "@heroicons/vue/20/solid";

const installDir = defineModel<number>({ required: true });
const { installDirs } = defineProps<{ installDirs: string[] }>();
</script>
