<template>
  <div class="w-full">
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
              {{ $t("library.admin.launchRow.currentDirHint") }}
            </div>
          </div>
          {{ $t("library.admin.import.version.installDir") }}
        </span>
        <Combobox
          as="div"
          :value="launchConfiguration.launch"
          nullable
          class="w-full"
          @update:model-value="(v) => updateLaunchCommand(v)"
        >
          <div class="relative">
            <ComboboxInput
              class="block flex-1 border-0 py-1.5 pl-1 w-full bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
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
                    <img
                      v-if="guess.type === 'executor'"
                      :src="useObject(guess.icon)"
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
                v-if="
                  launchProcessQuery &&
                  launchConfiguration.launch !== launchProcessQuery
                "
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
      </div>
      <div
        v-if="props.type && props.type === 'Executor'"
        class="ml-1 mt-2 rounded-lg bg-blue-900/10 p-1 outline outline-blue-900"
      >
        <div class="flex items-center">
          <div class="shrink-0">
            <InformationCircleIcon
              class="size-5 text-blue-500"
              aria-hidden="true"
            />
          </div>
          <div class="ml-2 inline-flex items-center">
            <p class="text-sm text-blue-200">
              <i18n-t
                keypath="library.admin.launchRow.executorHint"
                tag="span"
                scope="global"
              >
                <template #executor>
                  <span
                    class="font-mono bg-zinc-950 text-zinc-100 py-1 px-0.5 rounded-xl"
                    >{{
                      // eslint-disable-next-line @intlify/vue-i18n/no-raw-text
                      "{executor}"
                    }}</span
                  >
                </template>
              </i18n-t>
            </p>
          </div>
        </div>
      </div>
    </div>
    <SelectorPlatform
      :model-value="launchConfiguration.platform"
      class="mb-2"
      @update:model-value="updatePlatform"
    >
      {{ $t("library.admin.import.version.platform") }}
    </SelectorPlatform>
    <div v-if="props.type && props.type === 'Game' && props.allowExecutor">
      <h1 class="block text-sm font-medium leading-6 text-zinc-100">
        {{ $t("library.admin.launchRow.executorTitle") }}
      </h1>
      <div class="relative mt-2 space-x-1 inline-flex items-center w-full">
        <ExecutorWidget v-if="executor" :executor="executor" />
        <div
          v-else
          class="font-bold uppercase font-display text-zinc-500 text-sm"
        >
          {{ $t("library.admin.launchRow.noExecutorSelected") }}
        </div>
        <div class="grow" />
        <LoadingButton :loading="false" @click="selectLaunchOpen = true">{{
          $t("library.admin.launchRow.executorSelect")
        }}</LoadingButton>
        <button
          :disabled="!executor"
          class="transition rounded p-2 bg-zinc-900/30 group hover:enabled:bg-red-600/10 text-zinc-400 hover:enabled:text-red-600 disabled:bg-zinc-900/80 disabled:text-zinc-700"
          @click="() => (executor = undefined)"
        >
          <TrashIcon class="transition size-5" />
        </button>
      </div>
    </div>
    <div v-if="props.type && props.type === 'Executor'">
      <p class="block text-sm font-medium leading-6 text-zinc-100">
        {{ $t("library.admin.launchRow.autosuggestHint") }}
      </p>
      <SelectorFileExtension
        v-model="launchConfiguration.suggestions!"
        class="mt-2"
      />
    </div>
    <ModalSelectLaunch
      v-model="selectLaunchOpen"
      class="-mt-2"
      :filter-platform="launchConfiguration.platform"
      @select="(v) => (executor = v)"
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
import type { ExecutorLaunchObject } from "~/composables/frontend";
import type { GameType, Platform } from "~/prisma/client/enums";

import type { ImportVersion } from "~/server/api/v1/admin/import/version/index.post";
import type { VersionGuess } from "~/server/internal/library";

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
  if (!v) return;
  launchConfiguration.value.platform = v;
  if (executor.value) {
    if (executor.value.platform !== v) {
      executor.value = undefined;
    }
  }
}

const props = defineProps<{
  versionGuesses: Array<VersionGuess> | undefined;
  needsName: boolean;
  allowExecutor?: boolean;
  type?: GameType;
}>();

if (props.type && props.type === "Executor")
  launchConfiguration.value.suggestions ??= [];

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
      if (autosetGuess.type === "platform") {
        launchConfiguration.value.platform = autosetGuess.platform;
      } else if (autosetGuess.type === "executor") {
        executor.value = {
          launchId: autosetGuess.executorId,
          gameName: autosetGuess.gameName,
          gameIcon: autosetGuess.icon,
          versionName: autosetGuess.launchName,
          launchName: autosetGuess.launchName,
          platform: autosetGuess.platform,
        } satisfies ExecutorLaunchObject;
        launchConfiguration.value.platform = autosetGuess.platform;
      }
    }
  }
}
</script>
