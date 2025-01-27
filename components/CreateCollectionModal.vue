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
            <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-2xl bg-zinc-900 p-6 text-left align-middle shadow-xl transition-all">
              <DialogTitle as="h3" class="text-lg font-medium leading-6 text-white">
                Create Collection
              </DialogTitle>
              <div class="mt-2">
                <input
                  type="text"
                  v-model="collectionName"
                  placeholder="Collection name"
                  class="block w-full rounded-md border-0 bg-zinc-800 py-1.5 text-white shadow-sm ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>

              <div class="mt-4 flex justify-end gap-x-2">
                <button
                  type="button"
                  @click="$emit('close')"
                  class="inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  Cancel
                </button>
                <LoadingButton
                  :loading="isCreating"
                  :disabled="!collectionName"
                  @click="createCollection"
                  class="inline-flex items-center rounded-md bg-white/10 px-3 py-2 text-sm font-semibold font-display text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </LoadingButton>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  TransitionRoot,
  TransitionChild,
  Dialog,
  DialogPanel,
  DialogTitle,
} from '@headlessui/vue';

const props = defineProps<{
  show: boolean
  gameId?: string
}>();

const emit = defineEmits<{
  close: []
  created: [collectionId: string]
}>();

const collectionName = ref('');
const isCreating = ref(false);

const createCollection = async () => {
  if (!collectionName.value || isCreating.value) return;
  
  try {
    isCreating.value = true;
    
    // Create the collection
    const response = await $fetch('/api/v1/collection', {
      method: 'POST',
      body: { name: collectionName.value }
    });
    
    // Add the game if provided
    if (props.gameId) {
      await $fetch(`/api/v1/collection/${response.id}/entry`, {
        method: 'POST',
        body: { id: props.gameId }
      });
    }
    
    // Reset and emit
    collectionName.value = '';
    emit('created', response.id);
    emit('close');
  } catch (error) {
    console.error('Failed to create collection:', error);
  } finally {
    isCreating.value = false;
  }
};
</script> 
