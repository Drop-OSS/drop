<template>
  <div class="flex flex-row gap-x-4">
    <div class="relative size-24 bg-zinc-800 rounded-md overflow-hidden">
      <input
        id="icon-upload"
        type="file"
        class="hidden"
        accept="image/*"
        @change="addFile"
      />
      <img
        v-if="currentFileObjectUrl"
        :src="currentFileObjectUrl"
        class="absolute inset-0 object-cover w-full h-full"
      />
      <label
        for="icon-upload"
        class="absolute inset-0 cursor-pointer flex flex-col gap-y-1 items-center justify-center text-zinc-300 bg-zinc-900/50"
      >
        <ArrowUpTrayIcon class="size-6" />
        <span class="text-xs font-bold font-display uppercase">Upload</span>
      </label>
    </div>
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
  <div>
    <LoadingButton
      class="w-fit"
      :loading="props.loading"
      :disabled="!(name && description && currentFileObjectUrl)"
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
import { ArrowUpTrayIcon } from "@heroicons/vue/24/outline";

const currentFile = ref<File | undefined>(undefined);
const currentFileObjectUrl = ref<string | undefined>(undefined);

const emit = defineEmits<{
  import: [
    metadata: { name: string; description: string; icon: File } | undefined,
  ];
}>();

const name = ref("");
const description = ref("");

function addFile(event: Event) {
  const file = (event.target as HTMLInputElement)?.files?.[0];
  if (!file) return;

  if (currentFileObjectUrl.value) {
    URL.revokeObjectURL(currentFileObjectUrl.value);
  }

  currentFile.value = file;
  currentFileObjectUrl.value = URL.createObjectURL(file);
}

const props = defineProps<{
  gameName: string;
  loading: boolean;
  error?: string | undefined;
}>();

function importRedist() {
  if (!currentFile.value) return;
  emit("import", {
    name: name.value,
    description: description.value,
    icon: currentFile.value,
  });
}
</script>
