<template>
  <Listbox
    as="div"
    v-model="model.overrideHandler"
    class="mt-6"
    v-if="handlers.length > 1"
  >
    <ListboxLabel class="block text-sm/6 font-medium text-white"
      >Launch method</ListboxLabel
    >
    <div class="relative mt-2">
      <ListboxButton
        class="grid w-full cursor-default grid-cols-1 rounded-md bg-white/5 py-1.5 pr-2 pl-3 text-left text-white outline-1 -outline-offset-1 outline-white/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 sm:text-sm/6"
      >
        <span
          v-if="currentHandler"
          class="col-start-1 row-start-1 truncate pr-6"
          >{{ currentHandler.name }}</span
        >
        <span
          v-else
          class="col-start-1 row-start-1 truncate pr-6 italic text-zinc-400"
          >Automatic</span
        >
        <ChevronUpDownIcon
          class="col-start-1 row-start-1 size-5 self-center justify-self-end text-zinc-400 sm:size-4"
          aria-hidden="true"
        />
      </ListboxButton>

      <transition
        leave-active-class="transition ease-in duration-100"
        leave-from-class=""
        leave-to-class="opacity-0"
      >
        <ListboxOptions
          class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-800 py-1 text-base outline-1 -outline-offset-1 outline-white/10 sm:text-sm"
        >
          <ListboxOption
            as="template"
            :value="undefined"
            v-slot="{ active, selected }"
          >
            <li
              :class="[
                active ? 'bg-blue-500 text-white outline-hidden' : 'text-white',
                'relative cursor-default py-2 pr-9 pl-3 select-none',
              ]"
            >
              <span
                :class="[
                  selected ? 'font-semibold' : 'font-normal',
                  'block truncate italic',
                ]"
                >Automatic</span
              >
              <span class="block truncate text-xs text-zinc-400"
                >Pick the best method for this game.</span
              >

              <span
                v-if="selected"
                :class="[
                  active ? 'text-white' : 'text-blue-400',
                  'absolute inset-y-0 right-0 flex items-center pr-4',
                ]"
              >
                <CheckIcon class="size-5" aria-hidden="true" />
              </span>
            </li>
          </ListboxOption>
          <ListboxOption
            as="template"
            v-for="handler in handlers"
            :key="handler.id"
            :value="handler.id"
            v-slot="{ active, selected }"
          >
            <li
              :class="[
                active ? 'bg-blue-500 text-white outline-hidden' : 'text-white',
                'relative cursor-default py-2 pr-9 pl-3 select-none',
              ]"
            >
              <span
                :class="[
                  selected ? 'font-semibold' : 'font-normal',
                  'block truncate',
                ]"
                >{{ handler.name }}</span
              >
              <span class="block truncate text-xs text-zinc-400">{{
                handler.description
              }}</span>

              <span
                v-if="selected"
                :class="[
                  active ? 'text-white' : 'text-blue-400',
                  'absolute inset-y-0 right-0 flex items-center pr-4',
                ]"
              >
                <CheckIcon class="size-5" aria-hidden="true" />
              </span>
            </li>
          </ListboxOption>
        </ListboxOptions>
      </transition>
    </div>
    <p class="mt-2 text-sm text-zinc-400">
      Override how this game is launched.
    </p>
  </Listbox>
</template>

<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { ChevronUpDownIcon } from "@heroicons/vue/16/solid";
import { CheckIcon } from "@heroicons/vue/20/solid";
import type { GameVersion } from "~/types";

type ProcessHandlerOption = { id: string; name: string; description: string };

const model = defineModel<GameVersion["userConfiguration"]>({ required: true });
const props = defineProps<{ gameId: string }>();

const handlers = await invoke<ProcessHandlerOption[]>("get_process_handlers", {
  id: props.gameId,
});

const currentHandler = computed(() =>
  handlers.find((v) => v.id == model.value.overrideHandler),
);
</script>
