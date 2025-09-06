<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="flex flex-row gap-x-4">
    <label
      for="icon-upload"
      class="relative size-24 bg-zinc-800 rounded-md overflow-hidden has-[:focus]:ring-2 has-[:focus]:ring-blue-600"
    >
      <input
        id="icon-upload"
        type="file"
        class="sr-only"
        accept="image/*"
        @change="addFile"
      />
      <img
        v-if="currentFileObjectUrl"
        :src="currentFileObjectUrl"
        class="absolute inset-0 object-cover w-full h-full"
      />
      <div
        class="absolute inset-0 cursor-pointer flex flex-col gap-y-1 items-center justify-center text-zinc-300 bg-zinc-900/50"
      >
        <ArrowUpTrayIcon class="size-6" />
        <span class="text-xs font-bold font-display uppercase">Upload</span>
      </div>
    </label>
    <div class="grow flex flex-col gap-y-4">
      <div>
        <label for="name" class="block text-sm font-medium text-zinc-100"
          >Name</label
        >
        <input
          id="name"
          v-model="name"
          type="text"
          class="mt-1 block w-full rounded-md border-0 bg-zinc-950 py-1.5 text-white shadow-sm ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
        />
      </div>

      <div>
        <label for="description" class="block text-sm font-medium text-zinc-100"
          >Description</label
        >
        <input
          id="description"
          v-model="description"
          type="text"
          class="mt-1 block w-full rounded-md border-0 bg-zinc-950 py-1.5 text-white shadow-sm ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
        />
      </div>
    </div>
  </div>
  <SwitchGroup
    as="div"
    class="max-w-lg flex items-center justify-between gap-x-4"
  >
    <span class="flex flex-grow flex-col">
      <SwitchLabel
        as="span"
        class="text-sm font-medium leading-6 text-zinc-100"
        passive
        >Create as platform</SwitchLabel
      >
      <SwitchDescription as="span" class="text-sm text-zinc-400"
        >Versions for this redistributable will be able to take a series of
        launch commands. Intended to be used with emulators and similar
        programs.</SwitchDescription
      >
    </span>
    <Switch
      v-model="isPlatform"
      :class="[
        isPlatform ? 'bg-blue-600' : 'bg-zinc-800',
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
      ]"
    >
      <span
        aria-hidden="true"
        :class="[
          isPlatform ? 'translate-x-5' : 'translate-x-0',
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
        ]"
      />
    </Switch>
  </SwitchGroup>
  <div class="relative">
    <div class="flex flex-row gap-x-4">
      <label
        for="platform-icon-upload"
        class="relative size-24 bg-zinc-800 rounded-md overflow-hidden has-[:focus]:ring-2 has-[:focus]:ring-blue-600"
      >
        <input
          id="platform-icon-upload"
          type="file"
          class="sr-only"
          accept="image/svg+xml"
          :disabled="!isPlatform"
          @change="addSvg"
        />
        <div
          v-if="platform.icon"
          class="absolute inset-0 object-cover w-full h-full text-blue-600"
          v-html="platform.icon"
        />
        <div
          class="absolute inset-0 cursor-pointer flex flex-col gap-y-1 items-center justify-center text-zinc-300 bg-zinc-900/50 focus:text-zinc-100"
        >
          <ArrowUpTrayIcon class="size-6" />
          <span class="text-xs font-bold font-display uppercase"
            >Upload SVG</span
          >
        </div>
      </label>
      <div class="grow flex flex-col gap-y-4">
        <div>
          <label
            for="platform-name"
            class="block text-sm font-medium text-zinc-100"
            >Platform Name</label
          >
          <input
            id="platform-name"
            v-model="platform.name"
            type="text"
            :disabled="!isPlatform"
            class="mt-1 block w-full rounded-md border-0 bg-zinc-950 py-1.5 text-white shadow-sm ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          />
        </div>
      </div>
    </div>

    <div class="mt-2 w-full">
      <label for="platform-name" class="block text-sm font-medium text-zinc-100"
        >File Extensions           {{ currentExtDotted }}
</label
      >
      <Combobox
        as="div"
        :model-value="currentExtDotted"
        nullable
        class="mt-1 w-full"
        :disabled="!isPlatform"
        @update:model-value="(v) => addExt(v)"
      >
        <div class="relative">
          <ComboboxInput
            class="w-full block flex-1 rounded-lg border-1 border-zinc-800 py-2 px-2 bg-zinc-950 text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
            placeholder=".exe"
            @change="currentExt = $event.target.value"
            @blur="currentExt = ''"
          />
          <ComboboxOptions
            class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-white/5 focus:outline-none sm:text-sm"
          >
            <ComboboxOption
              v-if="currentExt"
              v-slot="{ active }"
              :value="currentExtDotted"
            >
              <li
                :class="[
                  'relative cursor-default select-none py-2 pl-3 pr-9',
                  active
                    ? 'bg-blue-600 text-white outline-none'
                    : 'text-zinc-100',
                ]"
              >
                <span class="block">
                  <span class="text-blue-300">filename</span
                  ><span class="font-semibold">{{ currentExtDotted }}</span>
                </span>
              </li>
            </ComboboxOption>
          </ComboboxOptions>
        </div>
      </Combobox>
      <div class="mt-2 flex gap-1 flex-wrap">
        <div
          v-for="ext in platform.fileExts"
          :key="ext"
          class="bg-blue-600/10 border-1 border-blue-700 rounded-full px-2 py-1 text-xs text-blue-400"
        >
          {{ ext }}
        </div>
        <span
          v-if="platform.fileExts.length == 0"
          class="uppercase font-display text-zinc-700 font-bold text-xs"
          >No suggested file extensions.</span
        >
      </div>
    </div>

    <div v-if="!isPlatform" class="absolute inset-0 bg-zinc-950/20" />
  </div>
  <div>
    <LoadingButton
      class="w-fit"
      :loading="props.loading"
      :disabled="buttonDisabled"
      @click="() => importRedist()"
    >
      {{ $t("library.admin.import.import") }}
    </LoadingButton>

    <div v-if="props.error" class="mt-4 w-fit rounded-md bg-red-600/10 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-600">
            {{ props.error }}
          </h3>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Switch,
  SwitchDescription,
  SwitchGroup,
  SwitchLabel,
} from "@headlessui/vue";
import { ArrowUpTrayIcon } from "@heroicons/vue/24/outline";

const currentFile = ref<File | undefined>(undefined);
const currentFileObjectUrl = ref<string | undefined>(undefined);

const emit = defineEmits<{
  import: [
    metadata: { name: string; description: string; icon: File } | undefined,
    platform: typeof platform.value | undefined,
  ];
}>();

const name = ref("");
const description = ref("");
const isPlatform = ref(false);
const currentExt = ref("");
const currentExtDotted = computed(() => {
  if(!currentExt.value) return "";
  const cleaned = currentExt.value.replace(/\W/g, "").toLowerCase();
  return `.${cleaned}`;
});
const platform = ref<{ name: string; icon: string; fileExts: string[] }>({
  name: "",
  icon: "",
  fileExts: [],
});

const buttonDisabled = computed<boolean>(
  () =>
    !(
      name.value &&
      description.value &&
      currentFileObjectUrl.value &&
      (!isPlatform.value || (platform.value.name && platform.value.icon))
    ),
);

function addFile(event: Event) {
  const file = (event.target as HTMLInputElement)?.files?.[0];
  if (!file) return;

  if (currentFileObjectUrl.value) {
    URL.revokeObjectURL(currentFileObjectUrl.value);
  }

  currentFile.value = file;
  currentFileObjectUrl.value = URL.createObjectURL(file);
}

async function addSvg(event: Event) {
  const file = (event.target as HTMLInputElement)?.files?.[0];
  if (!file) return;

  const svgContent = await file.text();
  const parser = new DOMParser();
  try {
    const document = parser.parseFromString(svgContent, "image/svg+xml");
    const svg = document.getElementsByTagName("svg").item(0);
    if (!svg) throw "No SVG in uploaded image.";
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    platform.value.icon = svg.outerHTML;
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: "Failed to upload SVG",
        description: (e as string)?.toString() ?? e,
      },
      (_, c) => c(),
    );
    return;
  }
}

function addExt(ext: string | null) {
  if (!ext) return;
  if (platform.value.fileExts.includes(ext)) return;
  platform.value.fileExts.push(ext);
  currentExt.value = "";
}

const props = defineProps<{
  gameName: string;
  loading: boolean;
  error?: string | undefined;
}>();

function importRedist() {
  if (!currentFile.value) return;
  emit(
    "import",
    {
      name: name.value,
      description: description.value,
      icon: currentFile.value,
    },
    isPlatform.value
      ? {
          ...platform.value,
          fileExts: platform.value.fileExts.map((e) => e.slice(1)),
        }
      : undefined,
  );
}
</script>
