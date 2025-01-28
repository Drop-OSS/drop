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
      <LoadingButton
        :loading="createCollectionLoading"
        :disabled="!collectionName"
        @click="() => createCollection()"
        class="w-full sm:w-fit"
      >
        Create
      </LoadingButton>
      <button
        type="button"
        class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 hover:bg-zinc-900 sm:mt-0 sm:w-auto"
        @click="() => close()"
        ref="cancelButtonRef"
      >
        Cancel
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { DialogTitle } from "@headlessui/vue";
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
const collections = await useCollections();

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

    collections.value.push(response);

    // Reset and emit
    collectionName.value = "";
    open.value = false;

    emit("created", response.id);
  } catch (error) {
    console.error("Failed to create collection:", error);

    const err = error as { statusMessage?: string };
    createModal(
      ModalType.Notification,
      {
        title: "Failed to create collection",
        description: `Drop couldn't create your collection: ${err?.statusMessage}`,
      },
      (_, c) => c()
    );
  } finally {
    createCollectionLoading.value = false;
  }
}
</script>
