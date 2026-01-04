<template>
  <div>
    <div v-if="needsName" class="mb-2">
      <div
        class="flex w-full rounded-md shadow-sm bg-zinc-950 ring-1 ring-inset ring-zinc-800 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-600"
      >
        <input
          id="startup"
          v-model="launchConfiguration.name"
          type="text"
          name="startup"
          class="block flex-1 border-0 py-1.5 px-3 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
          placeholder="Launch name"
        />
      </div>
    </div>
    <div class="mb-2">
      <div
        class="flex w-full rounded-md shadow-sm bg-zinc-950 ring-1 ring-inset ring-zinc-800 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-600"
      >
        <span
          class="flex select-none items-center gap-x-0.5 pl-3 text-zinc-500 sm:text-sm"
        >
          <div class="relative">
            <InformationCircleIcon class="peer size-4" />
            <div
              class="z-50 w-64 transition duration-100 opacity-0 shadow peer-hover:opacity-100 absolute left-0 p-2 bg-zinc-900 rounded text-xs text-zinc-300"
            >
              The string you provide is just run in the install directory, not
              actually appended to the path.
            </div>
          </div>
          {{ $t("library.admin.import.version.installDir") }}
        </span>
        <Combobox
          as="div"
          :value="launchConfiguration.launch"
          nullable
          @update:model-value="(v) => updateLaunchCommand(v)"
        >
          <div class="relative">
            <ComboboxInput
              class="block flex-1 border-0 py-1.5 pl-1 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
              :placeholder="
                $t('library.admin.import.version.launchPlaceholder')
              "
              @change="launchProcessQuery = $event.target.value"
              @blur="launchProcessQuery = ''"
            />
            <ComboboxButton
              v-if="launchFilteredVersionGuesses?.length ?? 0 > 0"
              class="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none"
            >
              <ChevronUpDownIcon
                class="size-5 text-gray-400"
                aria-hidden="true"
              />
            </ComboboxButton>

            <ComboboxOptions
              class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-white/5 focus:outline-none sm:text-sm"
            >
              <ComboboxOption
                v-for="guess in launchFilteredVersionGuesses"
                :key="guess.filename"
                v-slot="{ active, selected }"
                :value="guess.filename"
                as="template"
              >
                <li
                  :class="[
                    'relative cursor-default select-none py-2 pl-3 pr-9',
                    active
                      ? 'bg-blue-600 text-white outline-none'
                      : 'text-zinc-100',
                  ]"
                >
                  <span
                    :class="[
                      'inline-flex items-center gap-x-2 block truncate',
                      selected && 'font-semibold',
                    ]"
                  >
                    {{ guess.filename }}
                    <component
                      :is="PLATFORM_ICONS[guess.platform]"
                      class="size-5"
                    />
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
              <ComboboxOption
                v-if="launchProcessQuery"
                v-slot="{ active, selected }"
                :value="launchProcessQuery"
              >
                <li
                  :class="[
                    'relative cursor-default select-none py-2 pl-3 pr-9',
                    active
                      ? 'bg-blue-600 text-white outline-none'
                      : 'text-zinc-100',
                  ]"
                >
                  <span
                    :class="['block truncate', selected && 'font-semibold']"
                  >
                    {{ launchProcessQuery }}
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
        <input
          id="startup"
          v-model="launchConfiguration.launchArgs"
          type="text"
          name="startup"
          class="border-l border-zinc-700 block flex-1 border-0 py-1.5 pl-2 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
          placeholder="--launch"
        />
      </div>
    </div>
    <SelectorPlatform
      :model-value="launchConfiguration.platform"
      @update:model-value="updatePlatform"
      class="mb-2"
    >
      {{ $t("library.admin.import.version.platform") }}
    </SelectorPlatform>
    <div>
      <h1 class="block text-sm font-medium leading-6 text-zinc-100">
        Executor
      </h1>
      <div class="relative mt-2 space-x-3 inline-flex items-center w-full">
        <div
          v-if="executor"
          class="flex space-x-4 rounded-md bg-zinc-900/50 px-6 outline -outline-offset-1 outline-white/10 w-fit text-xs font-bold text-zinc-100"
        >
          <div class="inline-flex gap-x-2 items-center">
            <img :src="executor.gameIcon" class="size-6" />
            <span>{{ executor.gameName }}</span>
          </div>
          <div class="flex items-center">
            <svg
              class="h-full w-6 shrink-0 text-white/10"
              viewBox="0 0 24 44"
              preserveAspectRatio="none"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
            </svg>
            <span class="ml-4">{{ executor.versionName }}</span>
          </div>
          <div class="flex items-center">
            <svg
              class="h-full w-6 shrink-0 text-white/10"
              viewBox="0 0 24 44"
              preserveAspectRatio="none"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
            </svg>
            <span class="ml-4">{{ executor.launchName }}</span>
          </div>
        </div>
        <div
          v-else
          class="font-bold uppercase font-display text-zinc-500 text-sm"
        >
          No executor selected
        </div>
        <div class="grow" />
        <LoadingButton :loading="false" @click="selectLaunchOpen = true"
          >Select new executor</LoadingButton
        >
        <button
          @click="() => (executor = undefined)"
          class="transition rounded p-2 bg-zinc-900/30 group hover:enabled:bg-red-600/10 text-zinc-400 hover:enabled:text-red-600 disabled:bg-zinc-900/80 disabled:text-zinc-700"
          :disabled="!executor"
        >
          <TrashIcon class="transition size-5" />
        </button>
      </div>
    </div>
    <ModalSelectLaunch
      v-model="selectLaunchOpen"
      @select="(v) => (executor = v)"
      class="-mt-2"
      :filter-platform="launchConfiguration.platform"
    />
  </div>
</template>

<script setup lang="ts">
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/vue";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/20/solid";
import { InformationCircleIcon, TrashIcon } from "@heroicons/vue/24/outline";
import { ExecutorLaunchObject } from "~/composables/frontend";
import type { Platform } from "~/prisma/client/enums";

import type { ImportVersion } from "~/server/api/v1/admin/import/version/index.post";

const launchProcessQuery = ref("");

const launchConfiguration = defineModel<
  Omit<(typeof ImportVersion.infer)["launches"][number], "name"> & {
    name?: string;
  }
>({ required: true });
const _executorMetadata = ref<ExecutorLaunchObject | undefined>(undefined);
const executor = computed({
  get() {
    return _executorMetadata.value;
  },
  set(v) {
    _executorMetadata.value = v;
    if (v) {
      launchConfiguration.value.executorId = v.launchId;
    } else {
      launchConfiguration.value.executorId = undefined;
    }
  },
});

function updatePlatform(v: Platform | undefined) {
  if(!v) return;
  launchConfiguration.value.platform = v;
  if (executor.value) {
    if (executor.value.platform !== v) {
      executor.value = undefined;
    }
  }
}

const props = defineProps<{
  versionGuesses: Array<{ platform: Platform; filename: string }> | undefined;
  needsName: boolean;
}>();

const selectLaunchOpen = ref(false);

const launchFilteredVersionGuesses = computed(() =>
  props.versionGuesses?.filter((e) =>
    e.filename.toLowerCase().includes(launchProcessQuery.value.toLowerCase()),
  ),
);

function updateLaunchCommand(command: string) {
  launchConfiguration.value.launch = command;
  if (launchConfiguration.value.platform === undefined) {
    const autosetGuess = props.versionGuesses?.find(
      (v) => v.filename == command,
    );
    if (autosetGuess) {
      launchConfiguration.value.platform = autosetGuess.platform;
    }
  }
}
</script>
