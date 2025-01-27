<template>
  <TransitionRoot appear :show="show" as="template">
    <Dialog as="div" @close="$emit('close')" class="relative z-50">
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-zinc-950/80" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 text-center">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-xl bg-zinc-900 p-6 shadow-xl transition-all">
              <DialogTitle as="h3" class="text-lg font-bold font-display text-zinc-100">
                Delete Collection
              </DialogTitle>
              <div class="mt-2">
                <p class="text-sm text-zinc-400">
                  Are you sure you want to delete "{{ collection?.name }}"? This action cannot be undone.
                </p>
              </div>
              <div class="mt-6 flex justify-end gap-x-3">
                <button
                  @click="$emit('close')"
                  class="inline-flex items-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  @click="handleDelete"
                  class="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold font-display text-white hover:bg-red-500"
                >
                  Delete
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import {
  TransitionRoot,
  TransitionChild,
  Dialog,
  DialogPanel,
  DialogTitle,
} from '@headlessui/vue';

const props = defineProps<{
  show: boolean
  collection: Collection | null
}>();

const emit = defineEmits<{
  close: []
  deleted: [collectionId: string]
}>();

const handleDelete = async () => {
  if (!props.collection) return;
  
  try {
    await $fetch(`/api/v1/collection/${props.collection.id}`, { method: "DELETE" });
    emit('deleted', props.collection.id);
    emit('close');
  } catch (error) {
    console.error("Failed to delete collection:", error);
  }
};
</script> 
