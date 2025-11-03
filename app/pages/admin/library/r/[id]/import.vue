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

      <!-- install command -->
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
            <PreloadSelector
              :value="versionSettings.install"
              :guesses="versionGuesses"
              @update="(v) => updateInstallCommand(v)"
            />
            <input
              id="startup"
              v-model="versionSettings.installArgs"
              type="text"
              name="startup"
              class="border-l border-zinc-700 block flex-1 border-0 py-1.5 pl-2 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
              placeholder="--setup"
            />
          </div>
        </div>
      </div>
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
              <PreloadSelector
                :value="launch.launchCommand"
                :guesses="versionGuesses"
                @update="(v) => updateLaunchCommand(launchIdx, v)"
              />
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
      </div>
      <!-- uninstall command -->
      <div class="max-w-lg">
        <label
          for="startup"
          class="block text-sm font-medium leading-6 text-zinc-100"
          >Uninstall command</label
        >
        <p class="text-zinc-400 text-xs">
          Executable to be run on uninstalling a game. Useful for installer-only
          games.
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
            <PreloadSelector
              :value="versionSettings.uninstall"
              :guesses="versionGuesses"
              @update="(v) => updateUninstallCommand(v)"
            />
            <input
              id="startup"
              v-model="versionSettings.uninstallArgs"
              type="text"
              name="startup"
              class="border-l border-zinc-700 block flex-1 border-0 py-1.5 pl-2 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
              placeholder="--uninstall"
            />
          </div>
        </div>
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
          :model-value="versionSettings.delta || false"
          :class="[
            versionSettings.delta ? 'bg-blue-600' : 'bg-zinc-800',
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
          ]"
          @update:model-value="(v) => (versionSettings.delta = v)"
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

          <div class="text-zinc-400">
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
} from "@headlessui/vue";
import { XCircleIcon } from "@heroicons/vue/16/solid";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/20/solid";
import {
  PlusIcon,
  TrashIcon,
} from "@heroicons/vue/24/outline";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/vue/24/solid";
import type { SerializeObject } from "nitropack";
import type { ImportRedistVersion } from "~~/server/api/v1/admin/import/version/index.post";

definePageMeta({
  layout: "admin",
});

const router = useRouter();
const { t } = useI18n();
const route = useRoute();
const redistId = route.params.id.toString();
const versions = await $dropFetch(
  `/api/v1/admin/import/version?id=${encodeURIComponent(redistId)}&mode=redist`,
);
const userPlatforms = await useAdminPlatforms();
const allPlatforms = renderPlatforms(userPlatforms);
const currentlySelectedVersion = ref(-1);

const versionSettings = ref<Partial<ImportRedistVersion>>({
  launches: [],
});

const versionGuesses =
  ref<
    Array<SerializeObject<{ platform: PlatformRenderable; filename: string }>>
  >();

function updateLaunchCommand(idx: number, value: string) {
  versionSettings.value.launches![idx].launchCommand = value;
  autosetPlatform(value);
}

function updateInstallCommand(value: string) {
  versionSettings.value.install = value;
  autosetPlatform(value);
}

function updateUninstallCommand(value: string) {
  versionSettings.value.uninstall = value;
  autosetPlatform(value);
}

function autosetPlatform(value: string) {
  if (!versionGuesses.value) return;
  if (versionSettings.value.platform) return;
  const guessIndex = versionGuesses.value.findIndex(
    (e) => e.filename === value,
  );
  if (guessIndex == -1) return;
  versionSettings.value.platform =
    versionGuesses.value[guessIndex].platform.param;
}

const importLoading = ref(false);
const importError = ref<string | undefined>();

async function updateCurrentlySelectedVersion(value: number) {
  if (currentlySelectedVersion.value == value) return;
  currentlySelectedVersion.value = value;
  const version = versions[currentlySelectedVersion.value];
  const options = await $dropFetch(
    `/api/v1/admin/import/version/preload?id=${encodeURIComponent(
      redistId,
    )}&version=${encodeURIComponent(version)}&mode=redist`,
  );
  versionGuesses.value = options.map((e) => ({
    ...e,
    platform: allPlatforms.find((v) => v.param === e.platform)!,
  }));
  versionSettings.value.name = version;
}

async function startImport() {
  if (!versionSettings.value) return;
  const taskId = await $dropFetch("/api/v1/admin/import/version", {
    method: "POST",
    body: {
      id: redistId,
      version: versions[currentlySelectedVersion.value],
      mode: "redist",
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
