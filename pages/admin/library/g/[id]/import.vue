<template>
  <div class="flex flex-col gap-y-4">
    <Listbox
      as="div"
      :model-value="currentlySelectedVersion"
      class="max-w-lg"
      @update:model-value="(value) => updateCurrentlySelectedVersion(value)"
    >
      <ListboxLabel class="block text-sm font-medium leading-6 text-zinc-100">{{
        $t("library.admin.import.version.version")
      }}</ListboxLabel>
      <div class="relative mt-2">
        <ListboxButton
          class="relative w-full cursor-default rounded-md bg-zinc-950 py-1.5 pl-3 pr-10 text-left text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
        >
          <span v-if="currentlySelectedVersion != -1" class="block truncate">{{
            versions[currentlySelectedVersion]
          }}</span>
          <span v-else class="block truncate text-zinc-600">{{
            $t("library.admin.import.selectDir")
          }}</span>
          <span
            class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
          >
            <ChevronUpDownIcon
              class="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
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
              v-for="(version, versionIdx) in versions"
              :key="version"
              v-slot="{ active, selected }"
              as="template"
              :value="versionIdx"
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

    <div v-if="versionGuesses" class="flex flex-col gap-4">
      <!-- version name -->
      <div class="max-w-lg">
        <label
          for="startup"
          class="block text-sm font-medium leading-6 text-zinc-100"
          >Version name</label
        >
        <p class="text-zinc-400 text-xs">
          Shown to users when selecting what version to install.
        </p>
        <div class="mt-2">
          <input
            id="name"
            v-model="versionSettings.name"
            name="name"
            type="text"
            required
            placeholder="my version name"
            class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-950 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-800 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          />
        </div>
      </div>

      <!-- setup command -->
      <div class="max-w-lg">
        <label
          for="startup"
          class="block text-sm font-medium leading-6 text-zinc-100"
          >{{ $t("library.admin.import.version.setupCmd") }}</label
        >
        <p class="text-zinc-400 text-xs">
          {{ $t("library.admin.import.version.setupDesc") }}
        </p>
        <div class="mt-2">
          <div
            class="flex w-fit rounded-md shadow-sm bg-zinc-950 ring-1 ring-inset ring-zinc-800 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-600"
          >
            <span
              class="flex select-none items-center pl-3 text-zinc-500 sm:text-sm"
            >
              {{ $t("library.admin.import.version.installDir") }}
            </span>
            <Combobox
              as="div"
              :value="versionSettings.setup"
              nullable
              @update:model-value="(v) => updateSetupCommand(v)"
            >
              <div class="relative">
                <ComboboxInput
                  class="block flex-1 border-0 py-1.5 pl-1 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
                  :placeholder="
                    $t('library.admin.import.version.setupPlaceholder')
                  "
                  @change="setupProcessQuery = $event.target.value"
                  @blur="setupProcessQuery = ''"
                />
                <ComboboxButton
                  v-if="setupFilteredVersionGuesses?.length ?? 0 > 0"
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
                    v-for="guess in setupFilteredVersionGuesses"
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
                          :is="PLATFORM_ICONS[guess.platform as Platform]"
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
                    v-if="setupProcessQuery"
                    v-slot="{ active, selected }"
                    :value="setupProcessQuery"
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
                        {{ $t("chars.quoted", { text: setupProcessQuery }) }}
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
              v-model="versionSettings.setupArgs"
              type="text"
              name="startup"
              class="border-l border-zinc-700 block flex-1 border-0 py-1.5 pl-2 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
              placeholder="--setup"
            />
          </div>
        </div>
      </div>
      <!-- setup mode -->
      <SwitchGroup as="div" class="max-w-lg flex items-center justify-between">
        <span class="flex flex-grow flex-col">
          <SwitchLabel
            as="span"
            class="text-sm font-medium leading-6 text-zinc-100"
            passive
            >{{ $t("library.admin.import.version.setupMode") }}</SwitchLabel
          >
          <SwitchDescription as="span" class="text-sm text-zinc-400">{{
            $t("library.admin.import.version.setupModeDesc")
          }}</SwitchDescription>
        </span>
        <Switch
          v-model="versionSettings.onlySetup"
          :class="[
            versionSettings.onlySetup ? 'bg-blue-600' : 'bg-zinc-800',
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
          ]"
        >
          <span
            aria-hidden="true"
            :class="[
              versionSettings.onlySetup ? 'translate-x-5' : 'translate-x-0',
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            ]"
          />
        </Switch>
      </SwitchGroup>
      <!-- launch commands -->
      <div class="relative max-w-3xl">
        <label
          for="startup"
          class="block text-sm font-medium leading-6 text-zinc-100"
          >{{ $t("library.admin.import.version.launchCmd") }}</label
        >
        <p class="text-zinc-400 text-xs">
          {{ $t("library.admin.import.version.launchDesc") }}
        </p>
        <div class="mt-2 ml-4 flex flex-col gap-y-2 items-start">
          <div
            v-for="(launch, launchIdx) in versionSettings.launches"
            :key="launchIdx"
            class="inline-flex items-center gap-x-2"
          >
            <input
              id="launch-name"
              v-model="launch.name"
              type="text"
              name="launch-name"
              class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-950 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-800 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="My Launch Command"
            />

            <div
              class="flex w-full rounded-md shadow-sm bg-zinc-950 ring-1 ring-inset ring-zinc-800 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-600"
            >
              <span
                class="flex select-none items-center pl-3 text-zinc-500 sm:text-sm"
                >{{ $t("library.admin.import.version.installDir") }}</span
              >
              <Combobox
                as="div"
                :value="launch.launchCommand"
                nullable
                @update:model-value="(v) => updateLaunchCommand(launchIdx, v)"
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
                            :is="PLATFORM_ICONS[guess.platform as Platform]"
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
                          :class="[
                            'block truncate',
                            selected && 'font-semibold',
                          ]"
                        >
                          {{ $t("chars.quoted", { text: launchProcessQuery }) }}
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
                v-model="launch.launchArgs"
                type="text"
                name="startup"
                class="border-l border-zinc-700 block flex-1 border-0 py-1.5 pl-2 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
                placeholder="--launch"
              />
            </div>
            <button
              class="transition bg-zinc-800 rounded-sm aspect-square p-1 text-zinc-600 hover:text-red-600 hover:bg-red-600/20"
              @click="() => versionSettings.launches!.splice(launchIdx, 1)"
            >
              <TrashIcon class="size-5" />
            </button>
          </div>

          <p
            v-if="versionSettings.launches!.length == 0"
            class="uppercase font-display font-bold text-zinc-500 text-xs"
          >
            No launch commands
          </p>

          <LoadingButton
            :loading="false"
            class="inline-flex items-center gap-x-4"
            @click="
              () =>
                versionSettings.launches!.push({
                  name: '',
                  description: '',
                  launchCommand: '',
                  launchArgs: '',
                })
            "
          >
            Add new <PlusIcon class="size-5" />
          </LoadingButton>
        </div>
        <div
          v-if="versionSettings.onlySetup"
          class="absolute inset-0 bg-zinc-900/50"
        />
      </div>

      <PlatformSelector
        v-model="versionSettings.platform"
        class="max-w-lg"
        :platforms="allPlatforms"
      >
        {{ $t("library.admin.import.version.platform") }}
      </PlatformSelector>
      <SwitchGroup as="div" class="flex items-center justify-between max-w-lg">
        <span class="flex flex-grow flex-col">
          <SwitchLabel
            as="span"
            class="text-sm font-medium leading-6 text-zinc-100"
            passive
          >
            {{ $t("library.admin.import.version.updateMode") }}
          </SwitchLabel>
          <SwitchDescription as="span" class="text-sm text-zinc-400">
            {{ $t("library.admin.import.version.updateModeDesc") }}
          </SwitchDescription>
        </span>
        <Switch
          v-model="versionSettings.delta"
          :class="[
            versionSettings.delta ? 'bg-blue-600' : 'bg-zinc-800',
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
          ]"
        >
          <span
            aria-hidden="true"
            :class="[
              versionSettings.delta ? 'translate-x-5' : 'translate-x-0',
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            ]"
          />
        </Switch>
      </SwitchGroup>
      <Disclosure v-slot="{ open }" as="div" class="py-2 max-w-lg">
        <dt>
          <DisclosureButton
            class="border-b border-zinc-600 pb-2 flex w-full items-start justify-between text-left text-zinc-100"
          >
            <span class="text-base/7 font-semibold">
              {{ $t("library.admin.import.version.advancedOptions") }}
            </span>
            <span class="ml-6 flex h-7 items-center">
              <ChevronUpIcon v-if="!open" class="size-6" aria-hidden="true" />
              <ChevronDownIcon v-else class="size-6" aria-hidden="true" />
            </span>
          </DisclosureButton>
        </dt>
        <DisclosurePanel
          as="dd"
          class="bg-zinc-950/30 p-3 rounded-b-lg mt-2 flex flex-col gap-y-4"
        >
          <!-- UMU launcher configuration -->
          <div
            v-if="versionSettings.platform == 'Linux'"
            class="flex flex-col gap-y-4"
          >
            <SwitchGroup as="div" class="flex items-center justify-between">
              <span class="flex flex-grow flex-col">
                <SwitchLabel
                  as="span"
                  class="text-sm font-medium leading-6 text-zinc-100"
                  passive
                >
                  {{ $t("library.admin.import.version.umuOverride") }}
                </SwitchLabel>
                <SwitchDescription as="span" class="text-sm text-zinc-400">
                  {{ $t("library.admin.import.version.umuOverrideDesc") }}
                </SwitchDescription>
              </span>
              <Switch
                v-model="umuIdEnabled"
                :class="[
                  umuIdEnabled ? 'bg-blue-600' : 'bg-zinc-800',
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
                ]"
              >
                <span
                  aria-hidden="true"
                  :class="[
                    umuIdEnabled ? 'translate-x-5' : 'translate-x-0',
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  ]"
                />
              </Switch>
            </SwitchGroup>
            <div>
              <label
                for="umu-id"
                class="block text-sm font-medium leading-6 text-zinc-100"
              >
                {{ $t("library.admin.import.version.umuLauncherId") }}
              </label>
              <div class="mt-2">
                <input
                  id="umu-id"
                  v-model="umuId"
                  name="umu-id"
                  type="text"
                  autocomplete="umu-id"
                  required
                  :disabled="!umuIdEnabled"
                  placeholder="umu-starcitizen"
                  class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-950 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-800 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>
          </div>

          <div v-else class="text-zinc-400">
            {{ $t("library.admin.import.version.noAdv") }}
          </div>
        </DisclosurePanel>
      </Disclosure>

      <LoadingButton
        class="w-fit"
        :loading="importLoading"
        @click="startImport_wrapper"
      >
        {{ $t("library.admin.import.import") }}
      </LoadingButton>
      <div v-if="importError" class="mt-4 w-fit rounded-md bg-red-600/10 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-600">
              {{ importError }}
            </h3>
          </div>
        </div>
      </div>
    </div>
    <div
      v-else-if="currentlySelectedVersion != -1"
      role="status"
      class="inline-flex text-zinc-100 font-display font-semibold items-center gap-x-4"
    >
      {{ $t("library.admin.import.version.loadingVersion") }}
      <svg
        aria-hidden="true"
        class="w-6 h-6 text-transparent animate-spin fill-white"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
  Switch,
  SwitchDescription,
  SwitchGroup,
  SwitchLabel,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/vue";
import { XCircleIcon } from "@heroicons/vue/16/solid";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/20/solid";
import { PlusIcon, TrashIcon } from "@heroicons/vue/24/outline";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/vue/24/solid";
import type { SerializeObject } from "nitropack";
import type { Platform } from "~/prisma/client/enums";
import type { ImportVersion } from "~/server/api/v1/admin/import/version/index.post";

definePageMeta({
  layout: "admin",
});

const router = useRouter();
const { t } = useI18n();
const route = useRoute();
const gameId = route.params.id.toString();
const versions = await $dropFetch(
  `/api/v1/admin/import/version?id=${encodeURIComponent(gameId)}`,
);
const userPlatforms = await $dropFetch(
  "/api/v1/admin/import/version/platforms",
);
const allPlatforms = renderPlatforms(userPlatforms);
const currentlySelectedVersion = ref(-1);
const versionSettings = ref<Partial<typeof ImportVersion.infer>>({
  id: gameId,
  launches: [],
});

const versionGuesses =
  ref<Array<SerializeObject<{ platform: string; filename: string }>>>();

const launchProcessQuery = ref("");
const setupProcessQuery = ref("");

const launchFilteredVersionGuesses = computed(() =>
  versionGuesses.value?.filter((e) =>
    e.filename.toLowerCase().includes(launchProcessQuery.value.toLowerCase()),
  ),
);
const setupFilteredVersionGuesses = computed(() =>
  versionGuesses.value?.filter((e) =>
    e.filename.toLowerCase().includes(setupProcessQuery.value.toLowerCase()),
  ),
);

function updateLaunchCommand(idx: number, value: string) {
  versionSettings.value.launches![idx].launchCommand = value;
  autosetPlatform(value);
}

function updateSetupCommand(value: string) {
  versionSettings.value.setup = value;
  autosetPlatform(value);
}

function autosetPlatform(value: string) {
  if (!versionGuesses.value) return;
  if (versionSettings.value.platform) return;
  const guessIndex = versionGuesses.value.findIndex(
    (e) => e.filename === value,
  );
  if (guessIndex == -1) return;
  versionSettings.value.platform = versionGuesses.value[guessIndex].platform;
}

const umuIdEnabled = ref(false);
const umuId = computed({
  get() {
    if (umuIdEnabled.value) return versionSettings.value.umuId;
    return undefined;
  },
  set(v) {
    if (umuIdEnabled.value && v) {
      versionSettings.value.umuId = v;
    }
  },
});

const importLoading = ref(false);
const importError = ref<string | undefined>();

async function updateCurrentlySelectedVersion(value: number) {
  if (currentlySelectedVersion.value == value) return;
  currentlySelectedVersion.value = value;
  const version = versions[currentlySelectedVersion.value];
  const options = await $dropFetch(
    `/api/v1/admin/import/version/preload?id=${encodeURIComponent(
      gameId,
    )}&version=${encodeURIComponent(version)}`,
  );
  versionGuesses.value = options;
  versionSettings.value.name = version;
}

async function startImport() {
  if (!versionSettings.value) return;
  const taskId = await $dropFetch("/api/v1/admin/import/version", {
    method: "POST",
    body: {
      id: gameId,
      version: versions[currentlySelectedVersion.value],
      ...versionSettings.value,
    },
  });
  router.push(`/admin/task/${taskId.taskId}`);
}

function startImport_wrapper() {
  importLoading.value = true;
  startImport()
    .catch((error) => {
      importError.value = error.message ?? t("errors.unknown");
    })
    .finally(() => {
      importLoading.value = false;
    });
}
</script>
