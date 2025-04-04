<template>
  <TransitionRoot as="template" :show="!!open">
    <Dialog class="relative z-50" @close="open = false">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div
          class="fixed inset-0 bg-zinc-950 bg-opacity-75 transition-opacity"
        />
      </TransitionChild>

      <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div
          class="flex min-h-full items-start justify-center p-4 text-center sm:items-center sm:p-0"
        >
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel
              class="relative transform overflow-hidden rounded-lg bg-zinc-900 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6"
            >
              <div class="sm:flex sm:items-start">
                <div
                  class="mt-3 w-full text-center sm:ml-4 sm:mt-0 sm:text-left"
                >
                  <div class="mt-2">
                    <label
                      for="file-upload"
                      class="group cursor-pointer transition relative block w-full rounded-lg border-2 border-dashed border-zinc-600 p-12 text-center hover:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    >
                      <ArrowUpTrayIcon
                        class="transition mx-auto h-6 w-6 text-zinc-600 group-hover:text-zinc-700"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                      />
                      <span
                        class="transition mt-2 block text-sm font-semibold text-zinc-400 group-hover:text-zinc-500"
                        >Upload file</span
                      >
                      <p class="mt-1 text-xs text-zinc-400" v-if="currentFile">
                        {{ currentFile.name }}
                      </p>
                    </label>
                    <input
                      :accept="props.accept"
                      @change="(e) => file = (e.target as any)?.files"
                      class="hidden"
                      type="file"
                      id="file-upload"
                    />
                  </div>
                </div>
              </div>
              <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <LoadingButton
                  :disabled="currentFile == undefined"
                  type="button"
                  :loading="uploadLoading"
                  @click="() => uploadFile_wrapper()"
                  :class="[
                    'inline-flex w-full shadow-sm sm:ml-3 sm:w-auto',
                  ]"
                >
                  Upload
                </LoadingButton>
                <button
                  type="button"
                  class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 hover:bg-zinc-900 sm:mt-0 sm:w-auto"
                  @click="open = false"
                  ref="cancelButtonRef"
                >
                  Cancel
                </button>
              </div>
              <div v-if="uploadError" class="mt-3 rounded-md bg-red-600/10 p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <XCircleIcon
                      class="h-5 w-5 text-red-600"
                      aria-hidden="true"
                    />
                  </div>
                  <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-600">
                      {{ uploadError }}
                    </h3>
                  </div>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from "@headlessui/vue";
import { ArrowUpTrayIcon } from "@heroicons/vue/20/solid";
import { XCircleIcon } from "@heroicons/vue/24/solid";

const open = defineModel<boolean>();

const file = ref<FileList | undefined>();
const currentFile = computed(() => file.value?.item(0));
const props = defineProps<{
  endpoint: string;
  accept: string;
  options?: { [key: string]: string };
}>();
const emit = defineEmits(["upload"]);

const uploadLoading = ref(false);
const uploadError = ref<string | undefined>();
async function uploadFile() {
  if (!currentFile.value) return;

  const form = new FormData();
  form.append("file", currentFile.value);

  if (props.options) {
    for (const [key, value] of Object.entries(props.options)) {
      form.append(key, value);
    }
  }

  const result = await $dropFetch(props.endpoint, { method: "POST", body: form });
  open.value = false;
  file.value = undefined;
  emit("upload", result);
}

function uploadFile_wrapper() {
  uploadLoading.value = true;
  uploadFile()
    .catch((error) => {
      uploadError.value = error.statusMessage ?? "An unknown error occurred.";
    })
    .finally(() => {
      uploadLoading.value = false;
    });
}
</script>
