<template>
  <ModalTemplate v-model="open">
    <template #default>
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
    </template>

    <template #buttons="{ close }">
      <button
        type="button"
        @click="() => close()"
        class="inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        Cancel
      </button>
      <LoadingButton
        :loading="createCollectionLoading"
        :disabled="!collectionName"
        @click="() => createCollection()"
        class="inline-flex items-center rounded-md bg-white/10 px-3 py-2 text-sm font-semibold font-display text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Create
      </LoadingButton>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  TransitionRoot,
  TransitionChild,
  Dialog,
  DialogPanel,
  DialogTitle,
} from "@headlessui/vue";
import ModalTemplate from "~/drop-base/components/ModalTemplate.vue";

const props = defineProps<{
  gameId?: string;
}>();

const emit = defineEmits<{
  created: [collectionId: string];
}>();

const open = defineModel<boolean>();

const collectionName = ref("");
const createCollectionLoading = ref(false);

async function createCollection() {
  if (!collectionName.value || createCollectionLoading.value) return;

  try {
    createCollectionLoading.value = true;

    // Create the collection
    const response = await $fetch("/api/v1/collection", {
      method: "POST",
      body: { name: collectionName.value },
    });

    // Add the game if provided
    if (props.gameId) {
      await $fetch(`/api/v1/collection/${response.id}/entry`, {
        method: "POST",
        body: { id: props.gameId },
      });
    }

    // Reset and emit
    collectionName.value = "";
    open.value = false;

    emit("created", response.id);
  } catch (error) {
    console.error("Failed to create collection:", error);
    createModal(
      ModalType.Notification,
      {
        title: "Failed to create collection",
        description: `Drop couldn't create your collection: ${error}`,
      },
      (_, c) => c()
    );
  } finally {
    createCollectionLoading.value = false;
  }
}
</script>
