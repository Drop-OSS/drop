<template>
  <div class="flex flex-col gap-y-4 sm:max-w-[40rem]">
    <Listbox
      as="div"
      :model-value="currentlySelectedVersion"
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
            versions[currentlySelectedVersion].name
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
              :key="version.identifier"
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
                  >{{ version.name }}</span
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
      <!-- setup executable -->

      <div class="bg-zinc-800 p-4 rounded-xl relative flex flex-col gap-y-2">
        <div>
          <label class="block text-sm font-medium leading-6 text-zinc-100">{{
            $t("library.admin.import.version.setupCmd")
          }}</label>
          <p class="text-zinc-400 text-xs">
            {{ $t("library.admin.import.version.setupDesc") }}
          </p>
        </div>
        <ol
          v-if="versionSettings.setups.length > 0"
          class="divide-y-1 divide-zinc-700"
        >
          <li
            v-for="(launch, launchIdx) in versionSettings.setups"
            :key="launchIdx"
            class="py-2 inline-flex items-start gap-x-1 w-full"
          >
            <ImportVersionLaunchRow
              v-model="versionSettings.setups[launchIdx]"
              :version-guesses="versionGuesses"
              :needs-name="false"
            />
            <button
              class="transition rounded p-1 bg-zinc-900/30 group hover:bg-red-600/30"
              @click="() => versionSettings.setups.splice(launchIdx, 1)"
            >
              <TrashIcon
                class="transition size-5 text-zinc-700 group-hover:text-red-700"
              />
            </button>
          </li>
        </ol>
        <span
          v-else
          class="text-sm text-zinc-700 uppercase font-display font-bold"
          >{{ $t("library.admin.import.version.noSetups") }}</span
        >
        <LoadingButton
          :loading="false"
          class="w-fit"
          @click="() => versionSettings.setups.push({} as any)"
          >{{ $t("common.add") }}</LoadingButton
        >
      </div>
      <!-- setup mode -->
      <div class="relative">
        <SwitchGroup
          as="div"
          class="bg-zinc-800 p-4 rounded-xl flex items-center justify-between gap-4"
        >
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
              versionSettings.onlySetup ? 'bg-blue-600' : 'bg-zinc-900',
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
        <div
          v-if="type === GameType.Redist"
          class="absolute inset-0 bg-zinc-900/50"
        />
      </div>
      <!-- launch executables -->
      <div class="relative flex flex-col gap-y-2 bg-zinc-800 p-4 rounded-xl">
        <div>
          <label class="block text-sm font-medium leading-6 text-zinc-100">{{
            $t("library.admin.import.version.launchCmd")
          }}</label>
          <p class="text-zinc-400 text-xs">
            {{ $t("library.admin.import.version.launchDesc") }}
          </p>
        </div>
        <ol
          v-if="versionSettings.launches.length > 0"
          class="divide-y-1 divide-zinc-700"
        >
          <li
            v-for="(launch, launchIdx) in versionSettings.launches"
            :key="launchIdx"
            class="py-2 inline-flex items-start gap-x-1 w-full"
          >
            <Disclosure
              v-slot="{ open }"
              :default-open="true"
              as="div"
              class="py-2 px-3 w-full bg-zinc-900 rounded-lg"
            >
              <dt>
                <DisclosureButton
                  class="flex w-full items-center text-left text-white"
                >
                  <span v-if="launch.name" class="text-sm font-semibold">{{
                    launch.name
                  }}</span>
                  <span v-else class="text-sm text-zinc-500 italic">{{
                    $t("library.admin.import.version.noNameProvided")
                  }}</span>
                  <span class="ml-auto flex h-7 items-center">
                    <PlusIcon v-if="!open" class="size-6" aria-hidden="true" />
                    <MinusIcon v-else class="size-6" aria-hidden="true" />
                  </span>
                  <button
                    class="ml-1 transition rounded p-1 bg-zinc-900/30 group hover:bg-red-600/30"
                    @click.prevent="
                      () => versionSettings.launches.splice(launchIdx, 1)
                    "
                  >
                    <TrashIcon
                      class="transition size-5 text-zinc-700 group-hover:text-red-700"
                    />
                  </button>
                </DisclosureButton>
              </dt>
              <DisclosurePanel as="dd" class="mt-2">
                <ImportVersionLaunchRow
                  v-model="versionSettings.launches[launchIdx]"
                  :version-guesses="versionGuesses"
                  :needs-name="true"
                  :allow-executor="true"
                  :type="type"
                />
              </DisclosurePanel>
            </Disclosure>
          </li>
        </ol>
        <span
          v-else
          class="text-sm text-zinc-700 uppercase font-display font-bold"
          >{{ $t("library.admin.import.version.noLaunches") }}</span
        >
        <LoadingButton
          :loading="false"
          class="w-fit"
          @click="() => versionSettings.launches.push({} as any)"
          >{{ $t("common.add") }}</LoadingButton
        >

        <div
          v-if="versionSettings.onlySetup"
          class="absolute inset-0 bg-zinc-900/50"
        />
      </div>

      <SwitchGroup
        as="div"
        class="bg-zinc-800 p-4 rounded-xl flex items-center gap-4 justify-between"
      >
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
            versionSettings.delta ? 'bg-blue-600' : 'bg-zinc-900',
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

      <LoadingButton
        class="w-fit ml-auto"
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
import {
  CheckIcon,
  ChevronUpDownIcon,
  TrashIcon,
  MinusIcon,
  PlusIcon,
} from "@heroicons/vue/20/solid";
import { GameType } from "~/prisma/client/enums";
import type { ImportVersion } from "~/server/api/v1/admin/import/version/index.post";
import type { VersionGuess } from "~/server/internal/library";

definePageMeta({
  layout: "admin",
});

const router = useRouter();
const { t } = useI18n();
const route = useRoute();
const gameId = route.params.id.toString();
const { versions, type } = await $dropFetch(
  `/api/v1/admin/import/version?id=${encodeURIComponent(gameId)}`,
);
const currentlySelectedVersion = ref(-1);
const versionSettings = ref<Omit<typeof ImportVersion.infer, "version" | "id">>(
  {
    delta: false,
    onlySetup: type === GameType.Redist,
    launches: [],
    setups: [],
    requiredContent: [],
  },
);

const versionGuesses = ref<Array<VersionGuess>>();

const importLoading = ref(false);
const importError = ref<string | undefined>();

async function updateCurrentlySelectedVersion(value: number) {
  if (currentlySelectedVersion.value == value) return;
  currentlySelectedVersion.value = value;
  const version = versions[currentlySelectedVersion.value];
  try {
    const results = await $dropFetch(`/api/v1/admin/import/version/preload`, {
      failTitle: "Failed to fetch version information",
      query: {
        id: gameId,
        type: version.type,
        version: version.identifier,
      },
    });
    versionGuesses.value = results as typeof versionGuesses.value;
  } catch {
    currentlySelectedVersion.value = -1;
  }
}

async function startImport() {
  if (!versionSettings.value) return;
  const taskId = await $dropFetch("/api/v1/admin/import/version", {
    method: "POST",
    body: {
      ...versionSettings.value,
      id: gameId,
      version: versions[currentlySelectedVersion.value],
    },
  });
  router.push(`/admin/task/${taskId.taskId}`);
}

function startImport_wrapper() {
  importLoading.value = true;
  startImport()
    .catch((error) => {
      importError.value = error.statusMessage ?? t("errors.unknown");
    })
    .finally(() => {
      importLoading.value = false;
    });
}
</script>
