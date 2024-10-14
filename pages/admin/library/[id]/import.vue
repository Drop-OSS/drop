<template>
  <div class="flex flex-col gap-y-4">
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

    <div class="flex flex-col gap-8 max-w-md" v-if="versionSettings">
      <div>
        <label
          for="startup"
          class="block text-sm font-medium leading-6 text-zinc-100"
          >Startup executable/command</label
        >
        <p class="text-zinc-400 text-xs">Executable to launch the game</p>
        <div class="mt-2">
          <div
            class="flex rounded-md shadow-sm bg-zinc-950 ring-1 ring-inset ring-zinc-800 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-600 sm:max-w-md"
          >
            <span
              class="flex select-none items-center pl-3 text-zinc-500 sm:text-sm"
              >(install_dir)/</span
            >
            <input
              type="text"
              name="startup"
              id="startup"
              v-model="versionSettings.startup"
              class="block flex-1 border-0 py-1.5 pl-1 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
              placeholder="my-game.exe"
            />
          </div>
        </div>
      </div>
      <div>
        <label
          for="startup"
          class="block text-sm font-medium leading-6 text-zinc-100"
          >Setup executable/command</label
        >
        <p class="text-zinc-400 text-xs">Ran once when the game is installed</p>
        <div class="mt-2">
          <div
            class="flex rounded-md shadow-sm bg-zinc-950 ring-1 ring-inset ring-zinc-800 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-600 sm:max-w-md"
          >
            <span
              class="flex select-none items-center pl-3 text-zinc-500 sm:text-sm"
              >(install_dir)/</span
            >
            <input
              type="text"
              name="startup"
              id="startup"
              v-model="versionSettings.setup"
              class="block flex-1 border-0 py-1.5 pl-1 bg-transparent text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
              placeholder="setup.exe"
            />
          </div>
        </div>
      </div>
      <PlatformSelector v-model="versionSettings.platform">
        Version platform
      </PlatformSelector>
      <SwitchGroup as="div" class="flex items-center justify-between">
        <span class="flex flex-grow flex-col">
          <SwitchLabel
            as="span"
            class="text-sm font-medium leading-6 text-zinc-100"
            passive
            >Update mode</SwitchLabel
          >
          <SwitchDescription as="span" class="text-sm text-zinc-400"
            >When enabled, these files will be installed on top of (overwriting)
            the previous version's. If multiple "update modes" are chained
            together, they are applied in order.</SwitchDescription
          >
        </span>
        <Switch
          v-model="delta"
          :class="[
            delta ? 'bg-blue-600' : 'bg-zinc-800',
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
          ]"
        >
          <span
            aria-hidden="true"
            :class="[
              delta ? 'translate-x-5' : 'translate-x-0',
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            ]"
          />
        </Switch>
      </SwitchGroup>
      <LoadingButton
        @click="startImport_wrapper"
        class="w-fit"
        :loading="importLoading"
      >
        Import
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
      Loading version metadata...
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
      <span class="sr-only">Loading...</span>
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
} from "@headlessui/vue";
import { XCircleIcon } from "@heroicons/vue/16/solid";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/20/solid";

definePageMeta({
  layout: "admin",
});

const router = useRouter();

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
const versionSettings = ref<
  { platform: string; startup: string; setup: string } | undefined
>();
const delta = ref(false);

const importLoading = ref(false);
const importError = ref<string | undefined>();

async function updateCurrentlySelectedVersion(value: number) {
  if (currentlySelectedVersion.value == value) return;
  currentlySelectedVersion.value = value;
  const version = versions[currentlySelectedVersion.value];
  const results = await $fetch(
    `/api/v1/admin/import/version/preload?id=${encodeURIComponent(
      gameId
    )}&version=${encodeURIComponent(version)}`
  );
  versionSettings.value = {
    platform: results.platformGuess,
    startup: results.startupGuess,
    setup: "",
  };
}

async function startImport() {
  if (!versionSettings.value) return;
  const taskId = await $fetch("/api/v1/admin/import/version", {
    method: "POST",
    body: {
      id: gameId,
      version: versions[currentlySelectedVersion.value],
      platform: versionSettings.value.platform,
      startup: versionSettings.value.startup,
      setup: versionSettings.value.setup,
      delta: delta.value
    },
  });
  router.push(`/admin/task/${taskId.taskId}`);
}

function startImport_wrapper() {
  importLoading.value = true;
  startImport()
    .catch((error) => {
      importError.value = error.statusMessage ?? "An unknown error occurred.";
    })
    .finally(() => {
      importLoading.value = false;
    });
}
</script>
