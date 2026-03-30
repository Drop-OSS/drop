<template>
    <div class="relative z-50" @close="emit('event', 'close')">
        <div
          class="fixed inset-0 bg-zinc-950/75"
        />

      <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div
          class="flex min-h-full items-start justify-center p-4 text-center sm:items-center sm:p-0"
        >
            <div
              class="relative transform rounded-lg bg-zinc-900 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
            >
              <div class="px-4 pb-4 pt-5 space-y-4 sm:p-6 sm:pb-4">
                <div class="sm:flex sm:items-start">
                  <div class="mt-3 text-center sm:mt-0 sm:text-left">
                    <h3
                      class="text-base font-semibold text-zinc-100"
                      >{{ props.data.title }}
                  </h3>
                    <div class="mt-2">
                      <p class="text-sm text-zinc-400">
                        {{ props.data.description }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div
                class="rounded-b-lg bg-zinc-800 px-4 py-3 sm:flex sm:gap-x-2 sm:flex-row-reverse sm:px-6"
              >
                <LoadingButton
                  :loading="props.loading"
                  @click="emit('event', 'close')"
                  type="submit"
                  class="w-full sm:w-fit"
                >
                  {{ props.data.buttonText ?? "Close" }}
                </LoadingButton>
              </div>
            </div>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from "@headlessui/vue";
import type {
  ModalDatas,
  ModalEvents,
  ModalType,
} from "../composables/modal-stack";

const props = defineProps<{
  zHeight: number;
  loading: boolean;
  data: ModalDatas[ModalType.Notification];
}>();
const emit = defineEmits<{
  (e: "event", v: ModalEvents[ModalType.Notification]): void;
}>();
</script>
